/**
 * PolygonWebSocketManager.js
 * Backend WebSocket manager for Polygon.io with load balancing
 */
const redis = require("../utils/redis.helper");
const WebSocket = require("ws");

const SOCKET_URLS = {
  crypto: "wss://socket.polygon.io/crypto",
  forex: "wss://socket.polygon.io/forex",
};

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;
const MAX_CONNECTIONS_PER_MARKET = 1;

class PolygonWebSocketManager {
  constructor(apiKey) {
    this.apiKey = apiKey;
    // Map of market -> array of connection pools
    this.connectionPools = new Map();
    // Map of subscriptionKey -> set of client IDs
    this.subscriptions = new Map();
    // Map of client ID -> set of subscriptionKeys
    this.clientSubscriptions = new Map();
  }

  async checkSymbolInUse(symbol) {
    try {
      const openTrades = await redis.getOpenTradesBySymbol(symbol);
      if (openTrades.length > 0) {
        console.log(
          `[PolygonWS] Symbol ${symbol} has ${openTrades.length} open trades`
        );
        return true;
      }

      // Check pending orders
      const pendingOrders = await redis.getPendingOrdersBySymbol(symbol);
      if (pendingOrders.length > 0) {
        console.log(
          `[PolygonWS] Symbol ${symbol} has ${pendingOrders.length} pending orders`
        );
        return true;
      }

      return false;
    } catch (err) {
      console.error(
        `[PolygonWS] Error checking symbol usage for ${symbol}:`,
        err
      );
      // On error, be conservative and keep subscription
      return true;
    }
  }

  /**
   * Initialize connection pool for a market
   */
  initializeMarket(market) {
    if (this.connectionPools.has(market)) {
      return;
    }

    const pool = [];
    for (let i = 0; i < MAX_CONNECTIONS_PER_MARKET; i++) {
      pool.push(this.createConnection(market, i));
    }
    this.connectionPools.set(market, pool);
    console.log(
      `[PolygonWS] Initialized ${MAX_CONNECTIONS_PER_MARKET} connections for ${market}`
    );
  }

  /**
   * Create a single WebSocket connection
   */
  createConnection(market, index) {
    const url = SOCKET_URLS[market];
    const ws = new WebSocket(url);

    const connectionState = {
      ws,
      market,
      index,
      connected: false,
      authenticated: false,
      subscriptions: new Set(),
      subscriberCount: 0,
      reconnectAttempts: 0,
      reconnectTimer: null,
    };

    ws.on("open", () => {
      console.log(`[PolygonWS] Connection ${index} opened for ${market}`);
      connectionState.connected = true;
      this.authenticate(connectionState);
    });

    ws.on("message", (data) => {
      this.handleMessage(connectionState, data.toString());
    });

    ws.on("error", (error) => {
      console.error(
        `[PolygonWS] Connection ${index} error for ${market}:`,
        error.message
      );
    });

    ws.on("close", () => {
      console.log(`[PolygonWS] Connection ${index} closed for ${market}`);
      connectionState.connected = false;
      connectionState.authenticated = false;
      this.handleReconnect(connectionState);
    });

    return connectionState;
  }

  /**
   * Authenticate a connection
   */
  authenticate(connectionState) {
    if (!connectionState.ws || !connectionState.connected) return;

    const authMessage = {
      action: "auth",
      params: this.apiKey,
    };

    connectionState.ws.send(JSON.stringify(authMessage));
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(connectionState, data) {
    try {
      const messages = JSON.parse(data);
      const messageArray = Array.isArray(messages) ? messages : [messages];

      for (const msg of messageArray) {
        // Handle authentication response
        if (msg.ev === "status") {
          if (msg.status === "auth_success") {
            console.log(
              `[PolygonWS] Connection ${connectionState.index} authenticated for ${connectionState.market}`
            );
            connectionState.authenticated = true;
            connectionState.reconnectAttempts = 0;
            this.resubscribeAll(connectionState);
          } else if (msg.status === "auth_failed") {
            console.error(
              `[PolygonWS] Auth failed for connection ${connectionState.index}:`,
              msg.message
            );
          }
          continue;
        }

        // Normalize and broadcast to clients
        const normalized = this.normalizeMessage(msg, connectionState.market);
        if (normalized) {
          this.broadcastToClients(normalized);
        }
      }
    } catch (error) {
      console.error("[PolygonWS] Error parsing message:", error.message);
    }
  }

  /**
   * Normalize different message formats
   */
  normalizeMessage(msg, market) {
    let symbol = "";
    let price = 0;
    let volume = 0;
    let timestamp = 0;
    let open, high, low, close, vwap;

    if (market === "crypto") {
      if (msg.ev === "XT") {
        symbol = msg.pair;
        price = msg.p;
        volume = msg.s;
        timestamp = msg.t;
      } else if (msg.ev === "XA") {
        symbol = msg.pair;
        open = msg.o;
        high = msg.h;
        low = msg.l;
        close = msg.c;
        price = close;
        volume = msg.v;
        vwap = msg.vw;
        timestamp = msg.e || msg.s;
      }
    } else if (market === "forex") {
      if (msg.ev === "C") {
        symbol = msg.p?.replace("/", "-");
        if (typeof msg.a === "number" && typeof msg.b === "number") {
          price = (msg.a + msg.b) / 2; // ✅ mid-price
        } else if (typeof msg.a === "number") {
          price = msg.a;
        } else if (typeof msg.b === "number") {
          price = msg.b;
        } else {
          return null; // invalid
        }
        timestamp = msg.t;
      } else if (msg.ev === "CA") {
        symbol = msg.pair;
        open = msg.o;
        high = msg.h;
        low = msg.l;
        close = msg.c;
        price = close;
        timestamp = msg.e || msg.s;
      }
    }

    if (!symbol || price === undefined || price === null) return null;

    return {
      symbol,
      price,
      volume,
      timestamp,
      open,
      high,
      low,
      close,
      vwap,
    };
  }

  /**
   * Subscribe a client to a symbol
   */
  subscribe(clientId, market, symbol, channel = "AM") {
    // Initialize market if needed
    console.log("channel in subscribe:", channel);
    if (!this.connectionPools.has(market)) {
      this.initializeMarket(market);
    }

    const subscriptionKey = `${market}:${symbol}:${channel}`;

    // Add to subscriptions map
    if (!this.subscriptions.has(subscriptionKey)) {
      this.subscriptions.set(subscriptionKey, new Set());
    }
    this.subscriptions.get(subscriptionKey).add(clientId);

    // Track client subscriptions
    if (!this.clientSubscriptions.has(clientId)) {
      this.clientSubscriptions.set(clientId, new Set());
    }
    this.clientSubscriptions.get(clientId).add(subscriptionKey);

    // Find least loaded connection
    const connection = this.getLeastLoadedConnection(market);
    if (!connection) {
      console.error(`[PolygonWS] No available connections for ${market}`);
      return;
    }

    // Build subscription parameter
    const subscribeParam = this.buildSubscribeParam(symbol, market, channel);

    // Subscribe if not already subscribed on this connection
    if (!connection.subscriptions.has(subscribeParam)) {
      if (connection.authenticated && connection.ws) {
        this.sendSubscription(connection.ws, subscribeParam, "subscribe");
        connection.subscriptions.add(subscribeParam);
      } else {
        // Queue for when authenticated
        connection.subscriptions.add(subscribeParam);
      }
    }

    connection.subscriberCount++;
    console.log(
      `[PolygonWS] Client ${clientId} subscribed to ${subscriptionKey} on connection ${connection.index}`
    );
  }

  /**
   * Unsubscribe a client from a symbol
   */
  unsubscribe(clientId, market, symbol, channel = "AM") {
    const subscriptionKey = `${market}:${symbol}:${channel}`;
    const subscribers = this.subscriptions.get(subscriptionKey);

    if (subscribers) {
      subscribers.delete(clientId);

      // Remove from client subscriptions
      const clientSubs = this.clientSubscriptions.get(clientId);
      if (clientSubs) {
        clientSubs.delete(subscriptionKey);
      }

      // If no more subscribers, unsubscribe from Polygon
      if (subscribers.size === 0) {
        this.subscriptions.delete(subscriptionKey);
        this.unsubscribeFromPolygon(market, symbol, channel);
      }
    }

    console.log(
      `[PolygonWS] Client ${clientId} unsubscribed from ${subscriptionKey}`
    );
  }

  /**
   * Unsubscribe all subscriptions for a client
   */
  unsubscribeClient(clientId) {
    const clientSubs = this.clientSubscriptions.get(clientId);
    if (!clientSubs) return;

    for (const subscriptionKey of clientSubs) {
      const [market, symbol, channel] = subscriptionKey.split(":");
      this.unsubscribe(clientId, market, symbol, channel);
    }

    this.clientSubscriptions.delete(clientId);
    console.log(`[PolygonWS] All subscriptions removed for client ${clientId}`);
  }

  /**
   * Unsubscribe from Polygon WebSocket
   */
  async unsubscribeFromPolygon(market, symbol, channel) {
    const pool = this.connectionPools.get(market);
    if (!pool) return;

    const subscribeParam = this.buildSubscribeParam(symbol, market, channel);

    // ✅ NEW: Check Redis for active trades/orders before unsubscribing
    const hasActiveTrades = await this.checkSymbolInUse(symbol);

    if (hasActiveTrades) {
      console.log(
        `[PolygonWS] Keeping subscription for ${symbol} - active trades/orders exist`
      );
      return; // Don't unsubscribe from Polygon
    }

    // No trades/orders, safe to unsubscribe
    for (const connection of pool) {
      if (connection.subscriptions.has(subscribeParam)) {
        if (connection.ws && connection.authenticated) {
          this.sendSubscription(connection.ws, subscribeParam, "unsubscribe");
        }
        connection.subscriptions.delete(subscribeParam);
        connection.subscriberCount--;
      }
    }

    console.log(`[PolygonWS] Unsubscribed from Polygon: ${symbol}`);
  }
  t;

  /**
   * Get least loaded connection for a market
   */
  getLeastLoadedConnection(market) {
    const pool = this.connectionPools.get(market);
    if (!pool) return null;

    // Find authenticated connection with least subscribers
    const available = pool.filter((c) => c.authenticated);
    if (available.length === 0) return null;

    return available.reduce((min, conn) =>
      conn.subscriberCount < min.subscriberCount ? conn : min
    );
  }

  /**
   * Build subscription parameter
   */
  buildSubscribeParam(symbol, market, channel) {
    return `${channel}.${symbol}`;
  }

  /**
   * Send subscription message
   */
  sendSubscription(ws, param, action) {
    const message = {
      action,
      params: param,
    };
    ws.send(JSON.stringify(message));
    console.log(`[PolygonWS] ${action}: ${param}`);
  }

  /**
   * Resubscribe all symbols after reconnect
   */
  resubscribeAll(connectionState) {
    if (!connectionState.ws || !connectionState.authenticated) return;

    for (const param of connectionState.subscriptions) {
      this.sendSubscription(connectionState.ws, param, "subscribe");
    }
  }

  /**
   * Broadcast data to all subscribed clients
   */
  broadcastToClients(data) {
    // This will be called by the WebSocket server
    // The actual broadcasting is handled in polygon.controller.js
    if (this.onDataCallback) {
      this.onDataCallback(data);
    }
  }

  /**
   * Set callback for data broadcasting
   */
  setDataCallback(callback) {
    this.onDataCallback = callback;
  }

  /**
   * Handle reconnection
   */
  handleReconnect(connectionState) {
    if (connectionState.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[PolygonWS] Max reconnect attempts reached for connection ${connectionState.index}`
      );
      return;
    }

    connectionState.reconnectAttempts++;
    console.log(
      `[PolygonWS] Reconnecting connection ${connectionState.index} (attempt ${connectionState.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
    );

    connectionState.reconnectTimer = setTimeout(() => {
      const newConnection = this.createConnection(
        connectionState.market,
        connectionState.index
      );
      const pool = this.connectionPools.get(connectionState.market);
      if (pool) {
        pool[connectionState.index] = newConnection;
      }
    }, RECONNECT_DELAY);
  }

  /**
   * Disconnect all connections
   */
  disconnectAll() {
    for (const [market, pool] of this.connectionPools.entries()) {
      for (const connection of pool) {
        if (connection.reconnectTimer) {
          clearTimeout(connection.reconnectTimer);
        }
        if (connection.ws) {
          connection.ws.close();
        }
      }
      console.log(`[PolygonWS] Disconnected all connections for ${market}`);
    }
    this.connectionPools.clear();
    this.subscriptions.clear();
    this.clientSubscriptions.clear();
  }
}

module.exports = PolygonWebSocketManager;
