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

    units: {
      type: Number, // actual units traded
      required: true,
    },

    platformFee: {
      type: Number,
      default: 0,
    },

    tradeSize: {
      type: Number,
      required: true,
    },

    // Entry and Exit
    entryPrice: {
      type: Number,
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
    // openedAt: {
    //   type: Date,
    //   default: Date.now,
    // },
    closedAt: {
      type: Date,
    },

    // Profit & Loss
    pnl: {
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

    orderType: {
      type: String,
      enum: ["market", "limit", "stop"],
      required: true,
      default: "market",
    },

    // For limit/stop orders - the trigger price
    triggerPrice: {
      type: Number,
      // Required only for limit/stop orders
    },

    // Status now includes pending
    status: {
      type: String,
      enum: ["pending", "open", "closed", "cancelled"],
      default: "pending", // Changed default
    },

    // Track when order was placed vs when it executed
    placedAt: {
      type: Date,
      default: Date.now,
    },

    executedAt: {
      type: Date,
      // Set when pending order triggers
    },

    // Rule tracking (for compliance)
    violatedRules: [
      {
        type: String,
        enum: ["dailyDrawdown", "maxDrawdown"],
      },
    ],

    tradeClosureReason: {
      type: String,
      enum: [
        "userClosed",
        "stopLossHit",
        "takeProfitHit",
        "dailyDrawdownViolated",
        "maxDrawdownViolated",
        "maxSplitTaken",
        "accountSuspended",
        "accountPromotedToLive",
      ],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Trade", tradeSchema);
