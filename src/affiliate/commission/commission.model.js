const mongoose = require("mongoose");

const { Schema } = mongoose;

const commissionSchema = new Schema(
  {
    // Reference to the affiliate who earned this commission
    affiliate: {
      type: Schema.Types.ObjectId,
      ref: "Affiliate",
      required: true,
      index: true, // For efficient queries by affiliate
    },

    // Reference to the user who was referred (the one who generated this commission)
    referredUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Type of commission earned
    type: {
      type: String,
      enum: ["SIGNUP", "PURCHASE"],
      required: true,
    },

    // Commission amount earned
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Commission percentage used at the time of earning
    commissionPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // Affiliate tier at the time of earning this commission
    affiliateTier: {
      type: String,
      enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM"],
      required: true,
    },

    // For PURCHASE type commissions
    challenge: {
      type: Schema.Types.ObjectId,
      ref: "Challenge",
      required: function () {
        return this.type === "PURCHASE";
      },
    },

    // Original purchase/signup amount (for purchases, this is the challenge cost)
    originalAmount: {
      type: Number,
      required: function () {
        return this.type === "PURCHASE";
      },
      min: 0,
    },

    // Date when this commission was earned
    earnedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true, // For efficient date-based queries
    },

    // Additional metadata
    metadata: {
      // Referral code used
      referralCode: {
        type: String,
        required: true,
      },

      // Purchase date (for purchase commissions)
      purchaseDate: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
    // Compound indexes for efficient queries
    indexes: [
      { affiliate: 1, earnedAt: -1 }, // For affiliate commission history
      { affiliate: 1, type: 1 }, // For filtering by commission type
      { referredUser: 1, earnedAt: -1 }, // For user-specific commissions
      { earnedAt: -1 }, // For date-based queries
    ],
  }
);

// Virtual for formatted amount
commissionSchema.virtual("formattedAmount").get(function () {
  return `$${this.amount.toFixed(2)}`;
});

// Virtual for formatted original amount
commissionSchema.virtual("formattedOriginalAmount").get(function () {
  if (this.originalAmount) {
    return `$${this.originalAmount.toFixed(2)}`;
  }
  return null;
});

// Method to get commission details for display
commissionSchema.methods.getDisplayInfo = function () {
  const baseInfo = {
    id: this._id,
    type: this.type,
    amount: this.amount,
    formattedAmount: this.formattedAmount,
    commissionPercentage: this.commissionPercentage,
    affiliateTier: this.affiliateTier,
    earnedAt: this.earnedAt,
    status: this.status,
    referralCode: this.metadata.referralCode,
  };

  // Ensure referredUser is populated
  const referredUser =
    this.populated("referredUser") && this.referredUser
      ? {
          _id: this.referredUser._id,
          email: this.referredUser.email,
          name: this.referredUser.name,
        }
      : this.referredUser; // fallback to ObjectId if not populated

  if (this.type === "PURCHASE") {
    return {
      ...baseInfo,
      referredUser,
      challenge: this.challenge,
      originalAmount: this.originalAmount,
      formattedOriginalAmount: this.formattedOriginalAmount,
      purchaseDate: this.metadata.purchaseDate,
    };
  }

  return {
    ...baseInfo,
    referredUser,
    userSignupDate: this.metadata.userSignupDate,
  };
};

// Static method to get affiliate's commission summary
// Static method to get affiliate's commission summary - FIXED
commissionSchema.statics.getAffiliateSummary = async function (
  affiliateId,
  dateRange = {}
) {
  // Convert affiliateId to ObjectId if it's a string
  const objectIdAffiliateId =
    typeof affiliateId === "string"
      ? new mongoose.Types.ObjectId(affiliateId)
      : affiliateId;

  const matchStage = { affiliate: objectIdAffiliateId };

  // Add date range if provided
  if (dateRange.startDate || dateRange.endDate) {
    matchStage.earnedAt = {};
    if (dateRange.startDate) {
      matchStage.earnedAt.$gte = new Date(dateRange.startDate);
    }
    if (dateRange.endDate) {
      matchStage.earnedAt.$lte = new Date(dateRange.endDate);
    }
  }

  const summary = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCommissions: { $sum: "$amount" },
        totalEntries: { $sum: 1 },
        signupCommissions: {
          $sum: {
            $cond: [{ $eq: ["$type", "SIGNUP"] }, "$amount", 0],
          },
        },
        purchaseCommissions: {
          $sum: {
            $cond: [{ $eq: ["$type", "PURCHASE"] }, "$amount", 0],
          },
        },
        signupCount: {
          $sum: {
            $cond: [{ $eq: ["$type", "SIGNUP"] }, 1, 0],
          },
        },
        purchaseCount: {
          $sum: {
            $cond: [{ $eq: ["$type", "PURCHASE"] }, 1, 0],
          },
        },
      },
    },
  ]);

  // Return proper default values when no commissions found
  if (summary.length === 0) {
    return {
      totalCommissions: 0,
      totalEntries: 0,
      signupCommissions: 0,
      purchaseCommissions: 0,
      signupCount: 0,
      purchaseCount: 0,
    };
  }

  return summary[0];
};

// Static method to get monthly commission breakdown
commissionSchema.statics.getMonthlyBreakdown = async function (
  affiliateId,
  year
) {
  // Convert affiliateId to ObjectId if it's a string
  const objectIdAffiliateId =
    typeof affiliateId === "string"
      ? new mongoose.Types.ObjectId(affiliateId)
      : affiliateId;

  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year + 1}-01-01`);

  return await this.aggregate([
    {
      $match: {
        affiliate: objectIdAffiliateId,
        earnedAt: {
          $gte: startDate,
          $lt: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          month: { $month: "$earnedAt" },
          type: "$type",
        },
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.month": 1, "_id.type": 1 },
    },
  ]);
};

module.exports = mongoose.model("Commission", commissionSchema);
