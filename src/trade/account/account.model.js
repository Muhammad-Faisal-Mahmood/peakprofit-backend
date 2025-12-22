const mongoose = require("mongoose");
const redis = require("../../utils/redis.helper");
const accountLiquidatorWrapper = require("../../utils/accountLiquidatorWrapper");
const { Withdraw } = require("../../withdraw/withdraw.model");
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
    initialBalance: Number,
    balance: Number,
    equity: Number,
    marginUsed: Number,
    freeMargin: Number,
    leverage: { type: Number, default: 50 },

    // Risk tracking
    dailyDrawdownLimit: Number,
    maxDrawdownLimit: Number,
    profitTarget: Number,
    minTradingDays: {
      type: Number,
      default: 5,
    },
    activelyTradedDays: {
      type: Number,
      default: 0,
    },
    lastTradeTimestamp: { type: Date },

    // NEW: Track daily profits for consistency check
    dailyProfits: [
      {
        date: { type: Date, required: true },
        startingBalance: { type: Number, required: true },
        endingBalance: { type: Number, required: true },
        profitAmount: { type: Number, required: true },
        profitPercentage: { type: Number, required: true },
        meetsMinimum: { type: Boolean, default: false }, // true if >= 0.5%
      },
    ],

    // States
    status: {
      type: String,
      enum: ["active", "failed", "passed", "suspended", "closed"],
      default: "active",
    },

    openPositions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Trade" }],
    closedPositions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Trade" }],
    pendingOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Trade" }],
    cancelledOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Trade" }],

    currentDayEquity: {
      type: Number,
    },

    pendingMargin: {
      type: Number,
      default: 0,
    },

    lastPayoutDate: {
      type: Date,
      default: null,
    },
    totalPayoutAmount: {
      type: Number,
      default: 0,
    },
    payoutHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Withdraw",
      },
    ],

    // NEW: Flag to track if first payout has been processed
    hasReceivedFirstPayout: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// NEW: Method to check if user has 5 days with 0.5% profit
AccountSchema.methods.hasConsistentProfitDays = function () {
  if (!this.dailyProfits || this.dailyProfits.length === 0) {
    return {
      hasFiveDays: false,
      qualifiedDays: 0,
      message: "No trading days recorded with profit data",
    };
  }

  // Filter days that meet the 0.5% minimum profit requirement
  const qualifiedDays = this.dailyProfits.filter(
    (day) => day.meetsMinimum === true && day.profitPercentage >= 0.5
  );

  const hasFiveDays = qualifiedDays.length >= 5;

  return {
    hasFiveDays,
    qualifiedDays: qualifiedDays.length,
    message: hasFiveDays
      ? `${qualifiedDays.length} qualifying days found`
      : `Only ${qualifiedDays.length} day(s) with 0.5%+ profit. Need 5 days`,
    qualifyingDates: qualifiedDays.map((d) => d.date),
  };
};

// Method to check if account is eligible for payout
AccountSchema.methods.canRequestPayout = function () {
  const errors = [];

  // Check if account is live
  if (this.accountType !== "live") {
    errors.push("Only live accounts can request payouts");
  }

  // Check if account is active
  if (this.status !== "active") {
    errors.push(
      `Account status must be active. Current status: ${this.status}`
    );
  }

  // NEW: Check if user has 5 days with 0.5% profit
  const profitCheck = this.hasConsistentProfitDays();
  if (!profitCheck.hasFiveDays) {
    errors.push(
      `Consistency requirement not met: ${profitCheck.message}. You need at least 5 trading days with 0.5% or more profit.`
    );
  }

  // Check if balance meets minimum requirement (initialBalance + $100 profit)
  const minRequiredBalance = this.initialBalance + 100;
  if (this.balance < minRequiredBalance) {
    errors.push(
      `Minimum balance of $${minRequiredBalance.toFixed(
        2
      )} required. Current: $${this.balance.toFixed(2)}`
    );
  }

  // Check 5-day payout cycle
  if (this.lastPayoutDate) {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    if (this.lastPayoutDate > fiveDaysAgo) {
      const nextPayoutDate = new Date(this.lastPayoutDate);
      nextPayoutDate.setDate(nextPayoutDate.getDate() + 5);

      const timeLeftMs = nextPayoutDate.getTime() - Date.now();
      const hoursLeft = Math.ceil(timeLeftMs / (1000 * 60 * 60));
      const daysLeft = Math.floor(hoursLeft / 24);
      const remainingHours = hoursLeft % 24;

      let timeLeftMessage = "You can request payout again in ";
      if (daysLeft > 0) {
        timeLeftMessage += `${daysLeft} day${daysLeft > 1 ? "s" : ""}`;
        if (remainingHours > 0) {
          timeLeftMessage += ` and ${remainingHours} hour${
            remainingHours > 1 ? "s" : ""
          }`;
        }
      } else {
        timeLeftMessage += `${hoursLeft} hour${hoursLeft > 1 ? "s" : ""}`;
      }

      errors.push(`5-day payout cycle not met. ${timeLeftMessage}`);
    }
  }

  return {
    eligible: errors.length === 0,
    errors,
    profitDaysInfo: profitCheck,
  };
};

// Method to calculate available payout amount (85% of profit)
AccountSchema.methods.getAvailablePayoutAmount = function () {
  const profit = this.balance - this.initialBalance;

  if (profit <= 0 || profit < 100) {
    return 0;
  }

  // Return 85% of the profit
  return profit;
};

// NEW: Method to reset drawdown limits after first payout
AccountSchema.methods.resetDrawdownLimitsAfterPayout = async function () {
  // After first payout, user cannot go below initial balance
  // Set both drawdown limits to 0
  this.dailyDrawdownLimit = 0;
  this.maxDrawdownLimit = 0;

  console.log(
    `[Account] Drawdown limits reset to 0 for account ${this._id} after first payout. User cannot go below initial balance of ${this.initialBalance}`
  );

  try {
    const riskData = await redis.getAccountRisk(this._id);

    if (riskData) {
      // Update Redis with new drawdown settings
      await redis.updateAccountRisk(this._id, {
        dailyDrawdownLimit: 0,
        maxDrawdownLimit: 0,
        maxDrawdownThreshold: this.initialBalance, // Cannot go below initial balance
      });

      console.log(
        `[Account] Redis risk data updated for account ${this._id}. Protected balance set to ${this.initialBalance}`
      );
    }
  } catch (error) {
    console.error(
      `[Account] Error updating Redis risk data for account ${this._id}:`,
      error
    );
    // Don't throw - we can continue even if Redis update fails
  }
};

// Method to process payout
AccountSchema.methods.processPayout = async function (withdrawId, amount) {
  const availablePayout = this.getAvailablePayoutAmount();

  if (amount > availablePayout) {
    throw new Error(
      `Requested amount ($${amount.toFixed(
        2
      )}) exceeds available payout ($${availablePayout.toFixed(2)})`
    );
  }

  // Deduct the payout amount from balance
  this.balance -= amount;
  this.lastPayoutDate = new Date();
  this.totalPayoutAmount += amount;
  this.payoutHistory.push(withdrawId);

  // Get current equity from Redis (includes unrealized P&L)
  try {
    const riskData = await redis.getAccountRisk(this._id);
    if (riskData && riskData.equity !== undefined) {
      this.equity = riskData.equity - amount; // Deduct payout from current equity
    } else {
      this.equity = this.balance; // Fallback if Redis data not available
    }
  } catch (error) {
    console.error(`[Account] Error getting equity from Redis:`, error);
    this.equity = this.balance; // Fallback
  }

  this.freeMargin -= amount;

  // NEW: If this is the first payout, reset drawdown limits
  if (!this.hasReceivedFirstPayout) {
    this.hasReceivedFirstPayout = true;
    //  await this.resetDrawdownLimitsAfterPayout(); // Already updates Redis
    this.dailyDrawdownLimit = 0;
    this.maxDrawdownLimit = 0;
    // Update Redis with new balance and equity after first payout
    try {
      await redis.updateAccountRisk(this._id, {
        balance: this.balance,
        equity: this.equity,
        dailyDrawdownLimit: 0,
        maxDrawdownLimit: 0,
        maxDrawdownThreshold: this.initialBalance,
      });
      console.log(
        `[Account] Redis updated after first payout for account ${this._id}`
      );
    } catch (error) {
      console.error(
        `[Account] Error updating Redis after first payout:`,
        error
      );
    }
  } else {
    // Update Redis for subsequent payouts (balance/equity changed)
    try {
      await redis.updateAccountRisk(this._id, {
        balance: this.balance,
        equity: this.equity,
      });
      console.log(
        `[Account] Redis updated after payout for account ${this._id}`
      );
    } catch (error) {
      console.error(`[Account] Error updating Redis after payout:`, error);
    }
  }

  if (availablePayout > 0 && amount === availablePayout) {
    this.status = "closed";
    accountLiquidatorWrapper(this._id.toString(), "maxSplit", this.equity);
  }

  return this.save();
};

AccountSchema.methods.processRejectedPayout = async function (amount) {
  this.balance += amount;
  this.totalPayoutAmount -= amount;
  this.payoutHistory.pop();
  this.freeMargin += amount;

  // Get current equity from Redis and add the rejected amount back
  try {
    const riskData = await redis.getAccountRisk(this._id);
    if (riskData && riskData.equity !== undefined) {
      this.equity = riskData.equity + amount; // Add back rejected payout to current equity
    } else {
      this.equity = this.balance; // Fallback if Redis data not available
    }
  } catch (error) {
    console.error(`[Account] Error getting equity from Redis:`, error);
    this.equity = this.balance; // Fallback
  }

  if (this.payoutHistory.length === 0) {
    // First payout was rejected - restore original drawdown limits
    this.status = "active";
    this.hasReceivedFirstPayout = false;
    this.dailyDrawdownLimit = this.initialBalance * 0.02; // 2% of initial balance
    this.maxDrawdownLimit = this.initialBalance * 0.06; // 6% of initial balance
    this.lastPayoutDate = null;

    // Update Redis to restore original drawdown limits
    try {
      await redis.updateAccountRisk(this._id, {
        balance: this.balance,
        equity: this.equity,
        dailyDrawdownLimit: this.dailyDrawdownLimit,
        maxDrawdownLimit: this.maxDrawdownLimit,
        maxDrawdownThreshold: this.initialBalance - this.maxDrawdownLimit,
      });
      console.log(
        `[Account] Redis updated after first payout rejection for account ${this._id}`
      );
    } catch (error) {
      console.error(
        `[Account] Error updating Redis after payout rejection:`,
        error
      );
    }
  } else {
    // Get the last payout date from the previous withdrawal
    const lastWithdrawId = this.payoutHistory[this.payoutHistory.length - 1];
    const lastWithdraw = await Withdraw.findById(lastWithdrawId);
    this.lastPayoutDate = lastWithdraw?.requestedDate || null;

    // Update Redis with restored balance and equity
    try {
      await redis.updateAccountRisk(this._id, {
        balance: this.balance,
        equity: this.equity,
      });
      console.log(
        `[Account] Redis updated after subsequent payout rejection for account ${this._id}`
      );
    } catch (error) {
      console.error(
        `[Account] Error updating Redis after payout rejection:`,
        error
      );
    }
  }

  return this.save();
};

module.exports = mongoose.model("Account", AccountSchema);
