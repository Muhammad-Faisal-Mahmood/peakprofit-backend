// seed100kDemoReady.js

const path = require("path");

const mongoose = require("mongoose");
const Account = require("./trade/account/account.model");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

async function runSeeder() {
  try {
    const DB_URL = process.env.DB_URL;
    if (!DB_URL) throw new Error("DB_URL environment variable missing!");

    await mongoose.connect(DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to database");

    const userId = "6931a29de6b608e4df8b5d43";
    const initialBalance = 100000;

    // PeakProfit rules
    const leverage = 50;
    const dailyDrawdownLimit = initialBalance * 0.025; // 2.5%
    const maxDrawdownLimit = initialBalance * 0.07; // 7%
    const profitTarget = initialBalance * 0.08; // 8%
    const minTradingDays = 5;

    // Simulate rule completion
    const finalBalance = initialBalance + profitTarget + 100; // Slightly above target

    const account = await Account.create({
      userId,
      challengeId: null,
      accountType: "demo", // you asked for demo status
      status: "active", // remains active until you trade

      initialBalance,
      balance: finalBalance,
      equity: finalBalance,
      freeMargin: finalBalance,
      marginUsed: 0,
      leverage,

      dailyDrawdownLimit,
      maxDrawdownLimit,
      profitTarget,

      minTradingDays,
      activelyTradedDays: minTradingDays, // mark rule passed

      lastTradeTimestamp: new Date(),

      openPositions: [],
      closedPositions: [],
      pendingOrders: [],
      cancelledOrders: [],

      currentDayEquity: finalBalance,
      pendingMargin: 0,
    });

    console.log("\n🎉 Seeder Complete!");
    console.log("Created 100K demo-ready account:");
    console.log("Account ID:", account._id);
    console.log("Balance:", finalBalance);
    console.log("Status: active (demo)");
    console.log(
      "➡ You only need to place 1 trade to transition this account.\n"
    );

    await mongoose.disconnect();
    console.log("🔌 DB Disconnected");
  } catch (err) {
    console.error("❌ Seeder Error:", err);
    mongoose.disconnect();
  }
}

runSeeder();
