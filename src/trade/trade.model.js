const mongoose = require("mongoose");
const { Schema } = mongoose;

const tradeSchema = new Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Symbol Info
    symbol: {
      type: String,
      required: true,
      trim: true,
    },

    polygonSymbol: {
      type: String,
      required: true,
    },

    market: {
      type: String,
      enum: ["forex", "crypto"],
      default: "forex",
    },

    // Trade direction
    side: {
      type: String,
      enum: ["buy", "sell"],
      required: true,
    },

    // Trade size
    volume: {
      type: Number, // in lots or units depending on your platform
      required: true,
    },

    // Entry and Exit
    entryPrice: {
      type: Number,
      required: true,
    },
    exitPrice: {
      type: Number,
    },
    stopLoss: {
      type: Number,
    },
    takeProfit: {
      type: Number,
    },

    // Timestamps
    openedAt: {
      type: Date,
      default: Date.now,
    },
    closedAt: {
      type: Date,
    },

    // Profit & Loss
    profit: {
      type: Number,
      default: 0, // realized P&L
    },
    pnlPercent: {
      type: Number,
      default: 0, // relative to balance or volume
    },

    // Margin & Leverage impact
    marginUsed: {
      type: Number,
      default: 0,
    },
    leverage: {
      type: Number,
      default: 50, // same as Account default
    },

    // Status
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },

    // Rule tracking (for compliance)
    violatedRules: [
      {
        type: String,
        enum: [
          "dailyDrawdown",
          "maxDrawdown",
          "newsTrading",
          "marketClosure",
          "latencyArbitrage",
        ],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trade", tradeSchema);
