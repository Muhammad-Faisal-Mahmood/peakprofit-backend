/**
 * polygon.controller.js
 * WebSocket endpoint for real-time market data
 */

const express = require("express");
const expressWs = require("express-ws");
const PolygonWebSocketManager = require("./polygonWebSocketManager");
const tradeMonitorService = require("../trade/tradeMonitor.service");
const { polygonManager } = require("./polygonManager");
const HistoricalDataProcessor = require("../utils/historicalDataProcessor");
const allowedSymbols = require("../utils/allowedSymbols.json").symbols;

const historicalDataProcessor = new HistoricalDataProcessor({
  wickCompressionEnabled: true,
  wickCompressionFactor: 0.2,        // Heavy compression
  outlierZScoreThreshold: 2,         // Strict
  flashCrashThreshold: 0.03,         // 3%+ moves
  adaptToTimeframe: true
});

const router = express.Router();
expressWs(router);
const POLYGON_BASE_URL = "https://api.polygon.io";
router.get("/reference/tickers", async (req, res) => {
  try {
    const { search, market, active, limit } = req.query;

    let results = [...allowedSymbols]; // start with full list

    // Filter by search (matches ticker OR name OR base)
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(
        (t) =>
          t.ticker.toLowerCase().includes(s) ||
          t.base_currency_symbol.toLowerCase().includes(s) ||
          t.base_currency_name.toLowerCase().includes(s) ||
          t.name.toLowerCase().includes(s)
      );
    }

    // Filter by market (crypto / forex)
    if (market) {
      results = results.filter((t) => t.market === market);
    }

    // Filter by active
    if (active !== undefined) {
      const isActive = active === "true";
      results = results.filter((t) => t.active === isActive);
    }

    // Limit results
    if (limit) {
      results = results.slice(0, Number(limit));
    }

    res.json({
      status: "OK",
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("[Local Symbol Search] Error:", error.message);

    res.status(500).json({
      status: "ERROR",
      error: error.message,
    });
  }
});

// ✅ GET /aggs/ticker/:ticker/range/:multiplier/:timespan/:from/:to
router.get(
  "/aggs/ticker/:ticker/range/:multiplier/:timespan/:from/:to",
  async (req, res) => {
    try {
      const { ticker, multiplier, timespan, from, to } = req.params;

      const { adjusted, sort, limit } = req.query;

      // Build query parameters
      const params = new URLSearchParams();
      if (adjusted) params.append("adjusted", adjusted);
      if (sort) params.append("sort", sort);
      if (limit) params.append("limit", limit);
      params.append("apiKey", process.env.POLYGON_API_KEY);

      const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Polygon API responded with status ${response.status}`);
      }

      const data = await response.json();

      // ✅ Check if crypto BEFORE sending any response
      const isCrypto = ticker.startsWith("X:");
      if (isCrypto && data.results) {
        const normalizedData = historicalDataProcessor.process(data, timespan)
        res.json(normalizedData); // ✅ Send normalized data
      } else {
        res.json(data); // ✅ Send original data
      }
    } catch (error) {
      console.error(
        "[Polygon Proxy] Error fetching aggregates:",
        error.message
      );
      res.status(500).json({
        status: "ERROR",
        error: error.message,
      });
    }
  }
);

// ✅ GET /api/polygon/prev/:ticker
router.get("/prev/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    const { adjusted } = req.query;

    // Build query parameters
    const params = new URLSearchParams();
    if (adjusted) params.append("adjusted", adjusted);
    params.append("apiKey", process.env.POLYGON_API_KEY);

    // Construct Polygon endpoint
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${ticker}/prev?${params.toString()}`;

    // Fetch from Polygon
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Polygon API responded with status ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(
      "[Polygon Proxy] Error fetching previous close:",
      error.message
    );
    res.status(500).json({
      status: "ERROR",
      error: error.message,
    });
  }
});

// Initialize Polygon WebSocket Manager
// const polygonManager = new PolygonWebSocketManager(process.env.POLYGON_API_KEY);

// Map to store client WebSocket connections
const clients = new Map();

// Set callback for broadcasting data to clients
polygonManager.setDataCallback((data) => {
  tradeMonitorService.processPriceUpdate(data);
  // Find all clients subscribed to this symbol
  const subscriptionKey = `${data.symbol}`;

  clients.forEach((client, clientId) => {
    const clientSubs = polygonManager.clientSubscriptions.get(clientId);
    if (clientSubs) {
      for (const subKey of clientSubs) {
        const [market, symbol] = subKey.split(":");
        if (symbol === data.symbol && client.ws.readyState === 1) {
          client.ws.send(
            JSON.stringify({
              type: "data",
              data: data,
            })
          );
        }
      }
    }
  });
});

/**
 * WebSocket endpoint for market data streaming
 */
router.ws("/stream", (ws, req) => {
  const clientId = generateClientId();

  clients.set(clientId, { ws, subscriptions: new Set() });
  console.log(
    `[PolygonController] Client ${clientId} connected. Total clients: ${clients.size}`
  );

  // Send connection success
  ws.send(
    JSON.stringify({
      type: "connected",
      clientId: clientId,
    })
  );

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      handleClientMessage(clientId, data, ws);
    } catch (error) {
      console.error(
        `[PolygonController] Error parsing client message:`,
        error.message
      );
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        })
      );
    }
  });

  ws.on("close", () => {
    console.log(`[PolygonController] Client ${clientId} disconnected`);
    polygonManager.unsubscribeClient(clientId);
    clients.delete(clientId);
  });

  ws.on("error", (error) => {
    console.error(
      `[PolygonController] WebSocket error for client ${clientId}:`,
      error.message
    );
  });
});

/**
 * Handle messages from client
 */
function handleClientMessage(clientId, data, ws) {
  const { action, market, symbol, channel } = data;

  if (action === "subscribe") {
    if (!market || !symbol) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Market and symbol are required for subscription",
        })
      );
      return;
    }

    polygonManager.subscribe(clientId, market, symbol, channel || "AM");

    ws.send(
      JSON.stringify({
        type: "subscribed",
        market,
        symbol,
        channel: channel || "AM",
      })
    );
  } else if (action === "unsubscribe") {
    if (!market || !symbol) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Market and symbol are required for unsubscription",
        })
      );
      return;
    }

    polygonManager.unsubscribe(clientId, market, symbol, channel || "AM");

    ws.send(
      JSON.stringify({
        type: "unsubscribed",
        market,
        symbol,
        channel: channel || "AM",
      })
    );
  } else if (action === "ping") {
    ws.send(
      JSON.stringify({
        type: "pong",
      })
    );
  } else {
    ws.send(
      JSON.stringify({
        type: "error",
        message: `Unknown action: ${action}`,
      })
    );
  }
}

/**
 * Generate unique client ID
 */
function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * REST endpoint to get connection status
 */
router.get("/status", (req, res) => {
  const status = {
    connectedClients: clients.size,
    markets: {},
  };

  for (const [market, pool] of polygonManager.connectionPools.entries()) {
    status.markets[market] = {
      connections: pool.map((conn) => ({
        index: conn.index,
        connected: conn.connected,
        authenticated: conn.authenticated,
        subscriptions: conn.subscriptions.size,
        subscriberCount: conn.subscriberCount,
      })),
    };
  }

  res.json(status);
});

/**
 * Clean up on server shutdown
 */
process.on("SIGINT", () => {
  console.log("[PolygonController] Shutting down...");
  polygonManager.disconnectAll();
  process.exit(0);
});

module.exports = router;
