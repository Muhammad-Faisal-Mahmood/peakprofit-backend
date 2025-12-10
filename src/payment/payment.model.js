const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    // Core Payment Info
    whopPaymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "paid", "refunded", "failed", "disputed"],
      required: true,
    },
    substatus: {
      type: String,
      enum: ["pending", "succeeded", "failed", "requires_action"],
    },

    // User References
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      index: true,
    },

    // Whop References
    whopUserId: {
      type: String,
      required: true,
    },
    whopMembershipId: {
      type: String,
    },
    whopMemberId: {
      type: String,
    },
    membershipStatus: {
      type: String,
      enum: ["active", "trialing", "past_due", "canceled", "drafted"],
    },

    // Product & Plan Info
    productId: {
      type: String,
      required: true,
    },
    productTitle: {
      type: String,
    },
    planId: {
      type: String,
      required: true,
    },

    // Payment Amounts
    total: {
      type: Number,
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    usdTotal: {
      type: Number,
      required: true,
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
    amountAfterFees: {
      type: Number,
    },
    currency: {
      type: String,
      default: "usd",
    },

    // Payment Method Details
    paymentMethodId: {
      type: String,
    },
    paymentMethodType: {
      type: String,
      enum: ["card", "paypal", "crypto", "bank_transfer"],
    },
    cardBrand: {
      type: String,
    },
    cardLast4: {
      type: String,
    },
    cardExpMonth: {
      type: Number,
    },
    cardExpYear: {
      type: Number,
    },

    // Billing Address
    billingAddress: {
      name: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },

    // User Info (from Whop)
    userEmail: {
      type: String,
    },
    userName: {
      type: String,
    },
    userPhone: {
      type: String,
    },

    // Payment Status Flags
    refundable: {
      type: Boolean,
      default: false,
    },
    retryable: {
      type: Boolean,
      default: false,
    },
    voidable: {
      type: Boolean,
      default: false,
    },
    autoRefunded: {
      type: Boolean,
      default: false,
    },

    // Billing & Failure Info
    billingReason: {
      type: String,
      enum: ["one_time", "subscription", "trial"],
    },
    failureMessage: {
      type: String,
    },

    // Promo Code (Whop sends this as an object)
    promoCode: {
      id: String,
      code: String,
      amountOff: Number,
      baseCurrency: String,
      promoType: {
        type: String,
        enum: ["percentage", "fixed", "free_trial"],
      },
      numberOfIntervals: Number,
    },

    // Timestamps from Whop
    createdAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    lastPaymentAttempt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
    disputeAlertedAt: {
      type: Date,
    },

    // Metadata (flexible for custom data)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Internal Notes
    internalNotes: {
      type: String,
    },

    // Retry tracking for failed payments
    retryCount: {
      type: Number,
      default: 0,
    },
    lastRetryAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Indexes for common queries
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ challengeId: 1 });
paymentSchema.index({ whopUserId: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ "metadata.price": 1 });

// Virtual for amount in dollars
paymentSchema.virtual("amountInDollars").get(function () {
  return (this.total / 100).toFixed(2);
});

// Instance method to check if payment is successful
paymentSchema.methods.isSuccessful = function () {
  return this.status === "paid" && this.substatus === "succeeded";
};

// Instance method to check if payment failed
paymentSchema.methods.isFailed = function () {
  return this.status === "open" && this.substatus === "failed";
};

// Static method to get user's payment history
paymentSchema.statics.getUserPayments = async function (userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

// Static method to get failed payments that can be retried
paymentSchema.statics.getRetryablePayments = async function () {
  return this.find({
    status: "open",
    substatus: "failed",
    retryable: true,
    retryCount: { $lt: 3 },
  });
};

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
