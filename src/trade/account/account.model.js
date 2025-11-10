const mongoose = require("mongoose");
const AccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: false,
    },
    accountType: {
      type: String,
      enum: ["demo", "live"],
      default: "demo",
    },

    // Financials
    initialBalance: Number, // e.g. 100000
    balance: Number, // realized balance
    equity: Number, // balance + unrealized P&L
    marginUsed: Number, // sum of used margin
    freeMargin: Number, // equity - marginUsed
    leverage: { type: Number, default: 50 },

    // Risk tracking
    dailyDrawdownLimit: Number, // e.g. 5% of balance
    maxDrawdownLimit: Number, // e.g. 10% of initial balance
    profitTarget: Number, // e.g. 10% to pass challenge
    minTradingDays: {
      type: Number,
      default: 5,
    },
    activelyTradedDays: {
      type: Number,
      default: 0,
    },
    lastTradeTimestamp: { type: Date },
    // States
    status: {
      type: String,
      enum: ["active", "failed", "passed", "suspended"],
      default: "active",
    },

    openPositions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Trade" }],
    closedPositions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Trade" }],

    currentDayEquity: {
      type: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Account", AccountSchema);
