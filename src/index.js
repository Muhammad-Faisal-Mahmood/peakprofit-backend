const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const path = require("path");
const expressWs = require("express-ws");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

const auth = require("./auth/auth.controller");
const user = require("./user/user.controller");
const admin = require("./admin/admin.controller");
const subscription = require("./subscription/subscription.controller");
const contact = require("./contact/contact.controller");
const affiliate = require("./affiliate/affiliate.controller");
const challenge = require("./challenge/challenge.controller");
const withdraw = require("./withdraw/withdraw.controller");
const kyc = require("./kyc/kyc.controller");
const ticket = require("./ticket/ticket.controller");
const tradeJournal = require("./trade/journal/journal.controller");
const polygon = require("./polygon/polygon.controller");
const watchlist = require("./trade/watchlist/watchlist.controller");
const Account = require("./trade/account/account.controller");
const Trade = require("./trade/trade.controller");
const Chart = require("./trade/chart/chart.controller");
const Payment = require("./payment/payment.controller");
const ChartLayout = require("./trade/chartLayout/chartLayout.controller");

// Import for startup initialization
const { polygonManager } = require("./polygon/polygonManager");
const redis = require("./utils/redis.helper");
const jwt = require("./middleware/jwt");

const app = express();
expressWs(app); // Enable WebSocket support

const PORT = process.env.PORT || 3000;
const allowedOrigins = [
  process.env.MARKETING_SITE_URL,
  process.env.FRONT_APP_URL_DEV,
];

app.use("/api/whop", require("./paymentProcessor/payment.webhook"));

app.use(express.json());

// ✅ Serve static content from the public folder outside src
app.use(express.static(path.resolve(__dirname, "..", "public")));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Passport setup
app.use(
  session({
    secret: process.env.PASSPORT_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api/auth", auth);
app.use("/api/user", user);
app.use("/api/admin", admin);
app.use("/api/subscription", subscription);
app.use("/api/contact", contact);
app.use("/api/affiliate", affiliate);
app.use("/api/challenge", challenge);
app.use("/api/withdraw", withdraw);
app.use("/api/kyc", kyc);
app.use("/api/ticket", ticket);
app.use("/api/trade/journal", tradeJournal);
app.use("/api/polygon", polygon);
app.use("/api/trade/watchlist", watchlist);
app.use("/api/trade/account", Account);
app.use("/api/trade", Trade);
app.use("/api/trade/chart", Chart);
app.use("/api/payment", Payment);
app.use("/api/chartLayout", ChartLayout);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
  });
});
app.post(
  "/api/payment/session",
  jwt,
  require("./paymentProcessor/payment.sessionLink")
);

// MongoDB Connection
const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};

/**
 * 🎯 Initialize Polygon WebSocket and restore active subscriptions
 */
const initializePolygonConnections = async () => {
  console.log("\n========================================");
  console.log("🚀 Initializing Polygon WebSocket...");
  console.log("========================================\n");

  try {
    // Step 1: Initialize all market connections
    // await redis.clearAll();
    console.log("[Startup] Initializing market connections...");
    const markets = ["crypto", "forex"];

    for (const market of markets) {
      polygonManager.initializeMarket(market);
    }

    // Step 2: Wait for connections to authenticate (give it a few seconds)
    console.log("[Startup] Waiting for authentication...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 3: Fetch all open trades from Redis
    console.log("[Startup] Fetching open trades from Redis...");
    const openTradesKeys = await redis.getOpenTradesBySymbol("*"); // Get all

    // Since getOpenTradesBySymbol takes a specific symbol, we need to get all keys
    // Let's create a helper to get all open trades
    const allOpenTrades = [];
    const tradeKeys = await getAllRedisKeys("trade:open:*");

    for (const key of tradeKeys) {
      const tradeData = await redis.getOpenTrade(key.split(":")[2]); // Extract tradeId
      if (tradeData) {
        allOpenTrades.push(tradeData);
      }
    }

    // Step 4: Fetch all pending orders from Redis
    console.log("[Startup] Fetching pending orders from Redis...");
    const allPendingOrders = [];
    const orderKeys = await getAllRedisKeys("order:pending:*");

    for (const key of orderKeys) {
      const orderData = await redis.getPendingOrder(key.split(":")[2]); // Extract orderId
      if (orderData) {
        allPendingOrders.push(orderData);
      }
    }

    // Step 5: Extract unique symbols and their markets
    const symbolsToSubscribe = new Map(); // Map<symbol, market>

    // From open trades
    for (const trade of allOpenTrades) {
      if (trade.symbol && trade.market) {
        symbolsToSubscribe.set(trade.symbol, trade.market);
      }
    }

    // From pending orders
    for (const order of allPendingOrders) {
      if (order.symbol && order.market) {
        symbolsToSubscribe.set(order.symbol, order.market);
      }
    }

    // Step 6: Subscribe to all symbols
    console.log(
      `[Startup] Found ${symbolsToSubscribe.size} unique symbols to subscribe`
    );

    if (symbolsToSubscribe.size > 0) {
      const systemClientId = "system_startup";

      for (const [symbol, market] of symbolsToSubscribe.entries()) {
        try {
          console.log(`[Startup] Subscribing to ${market}:${symbol}`);
          polygonManager.subscribe(systemClientId, market, symbol, "XT");
        } catch (error) {
          console.error(
            `[Startup] Failed to subscribe to ${symbol}:`,
            error.message
          );
        }
      }

      console.log(
        `\n✅ Successfully subscribed to ${symbolsToSubscribe.size} symbols`
      );
    } else {
      console.log(
        "\n✅ No active trades or pending orders found. Ready to start server."
      );
    }

    console.log("\n========================================");
    console.log("✅ Polygon initialization complete!");
    console.log("========================================\n");

    return {
      openTrades: allOpenTrades.length,
      pendingOrders: allPendingOrders.length,
      subscribedSymbols: symbolsToSubscribe.size,
    };
  } catch (error) {
    console.error("\n❌ Error initializing Polygon connections:", error);
    throw error;
  }
};

/**
 * Helper function to get all Redis keys matching a pattern
 * Note: Using KEYS in production is not recommended for large datasets
 * Consider using SCAN for production environments
 */
const getAllRedisKeys = async (pattern) => {
  const client = require("./config/redis.config");

  try {
    const keys = await client.sendCommand(["KEYS", pattern]);
    console.log("keys", keys);
    return keys;
  } catch (err) {
    console.error(`[Redis] KEYS failed for pattern ${pattern}:`, err);
    return [];
  }
};

/**
 * 🚀 Main startup sequence
 */
const startServer = async () => {
  try {
    // Step 1: Connect to MongoDB
    await connectToMongoDB();

    // Step 2: Initialize Polygon and restore subscriptions
    const stats = await initializePolygonConnections();

    // Step 3: Start the Express server
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`🎉 Server is running on http://localhost:${PORT}`);
      console.log(`========================================`);
      console.log(`📊 Startup Summary:`);
      console.log(`   - Open Trades: ${stats.openTrades}`);
      console.log(`   - Pending Orders: ${stats.pendingOrders}`);
      console.log(`   - Active Subscriptions: ${stats.subscribedSymbols}`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error("\n❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the application
startServer();
