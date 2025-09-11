const mongoose = require("mongoose");

const { Schema } = mongoose;

// Sub-schema for individual referral records
const referralRecordSchema = new Schema(
  {
    referredUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    signupDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    signupCommission: {
      type: Number,
      default: 1, // $1 for signup
    },
    purchases: [
      {
        challenge: {
          type: Schema.Types.ObjectId,
          ref: "Challenge",
          required: true,
        },
        purchaseDate: {
          type: Date,
          required: true,
          default: Date.now,
        },
        challengeCost: {
          type: Number,
          required: true,
        },
        commissionEarned: {
          type: Number,
          required: true,
        },
        commissionPercentage: {
          type: Number,
          required: true,
        },
      },
    ],
    totalEarnings: {
      type: Number,
      default: 1, // Starts with signup commission
    },
  },
  { timestamps: true }
);

const affiliateSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one affiliate profile per user
    },
    tier: {
      type: String,
      enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM"],
      default: "BRONZE",
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    referralLink: {
      type: String,
      required: true,
    },
    // UPDATED: Now stores detailed referral records instead of just user IDs
    referrals: [referralRecordSchema],

    // UPDATED: This will be calculated from referral records
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    // NEW: Current available balance (totalEarnings - totalWithdrawn)
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    commissionPercentage: {
      type: Number,
      default: 5,
      min: 0,
      max: 100,
      required: true,
    },
    // Track total number of referrals for quick access
    totalReferrals: {
      type: Number,
      default: 0,
      min: 0,
    },
    // NEW: Array of withdraw references
    withdraws: [
      {
        type: Schema.Types.ObjectId,
        ref: "Withdraw",
      },
    ],
    // NEW: Track total amount withdrawn
    totalWithdrawn: {
      type: Number,
      default: 0,
      min: 0,
    },
    // NEW: Track tier upgrade history
    tierHistory: [
      {
        tier: {
          type: String,
          enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM"],
          required: true,
        },
        upgradedAt: {
          type: Date,
          default: Date.now,
        },
        referralsCount: {
          type: Number,
          required: true,
        },
        commissionPercentage: {
          type: Number,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

// Initialize tier history on creation
affiliateSchema.pre("save", function (next) {
  if (this.isNew && this.tierHistory.length === 0) {
    this.tierHistory.push({
      tier: this.tier,
      upgradedAt: new Date(),
      referralsCount: this.totalReferrals,
      commissionPercentage: this.commissionPercentage,
    });
  }
  next();
});

// Method to add a new referral
affiliateSchema.methods.addReferral = function (referredUserId) {
  const newReferral = {
    referredUser: referredUserId,
    signupDate: new Date(),
    signupCommission: 1,
    purchases: [],
    totalEarnings: 1,
  };

  this.referrals.push(newReferral);
  this.totalReferrals += 1;
  this.totalEarnings += 1;
  this.balance += 1; // NEW: Update balance

  return this.save();
};

// Method to add a purchase to an existing referral
affiliateSchema.methods.addPurchase = function (
  referredUserId,
  challengeId,
  challengeCost
) {
  const referral = this.referrals.find(
    (ref) => ref.referredUser.toString() === referredUserId.toString()
  );

  if (!referral) {
    throw new Error("Referral record not found");
  }

  const commissionEarned = (challengeCost * this.commissionPercentage) / 100;

  const purchase = {
    challenge: challengeId,
    purchaseDate: new Date(),
    challengeCost: challengeCost,
    commissionEarned: commissionEarned,
    commissionPercentage: this.commissionPercentage,
  };

  referral.purchases.push(purchase);
  referral.totalEarnings += commissionEarned;
  this.totalEarnings += commissionEarned;
  this.balance += commissionEarned; // NEW: Update balance

  return this.save();
};

// NEW: Method to upgrade tier
affiliateSchema.methods.upgradeTier = function (
  newTier,
  newCommissionPercentage
) {
  const oldTier = this.tier;

  this.tier = newTier;
  this.commissionPercentage = newCommissionPercentage;

  // Add to tier history
  this.tierHistory.push({
    tier: newTier,
    upgradedAt: new Date(),
    referralsCount: this.totalReferrals,
    commissionPercentage: newCommissionPercentage,
  });

  return {
    oldTier,
    newTier,
    newCommissionPercentage,
  };
};

// NEW: Method to process a withdrawal
affiliateSchema.methods.processWithdraw = function (
  withdrawId,
  amount,
  status
) {
  // Check if the withdrawal would make balance negative
  if (status === "PENDING" && this.balance < amount) {
    throw new Error(
      `Insufficient balance. Available: $${this.balance.toFixed(
        2
      )}, Attempted withdrawal: $${amount.toFixed(2)}`
    );
  }

  if (status === "PENDING") {
    this.withdraws.push(withdrawId);
    this.totalWithdrawn += amount;
    this.balance -= amount;
  }

  if (status === "DENIED") {
    this.totalWithdrawn -= amount;
    this.balance += amount;
  }

  return this.save();
};

// NEW: Method to get available balance
affiliateSchema.methods.getAvailableBalance = function () {
  return this.balance;
};

// NEW: Method to validate withdrawal amount
affiliateSchema.methods.canWithdraw = function (amount) {
  return this.balance >= amount && amount > 0;
};

// NEW: Method to get tier eligibility
affiliateSchema.methods.getTierEligibility = function () {
  const referrals = this.totalReferrals;

  if (referrals >= 100) return "PLATINUM";
  if (referrals >= 50) return "GOLD";
  if (referrals >= 10) return "SILVER";
  return "BRONZE";
};

// NEW: Method to check if tier upgrade is due
affiliateSchema.methods.needsTierUpgrade = function () {
  const eligibleTier = this.getTierEligibility();
  const tierOrder = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];

  return tierOrder.indexOf(eligibleTier) > tierOrder.indexOf(this.tier);
};

module.exports = mongoose.model("Affiliate", affiliateSchema);
