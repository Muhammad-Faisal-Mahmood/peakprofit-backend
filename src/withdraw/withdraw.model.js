const mongoose = require("mongoose");

const { Schema } = mongoose;

// Sub-schema for payment method details
const paymentMethodSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["BANK_ACCOUNT", "PAYPAL", "STRIPE", "CRYPTO", "OTHER"],
      required: true,
    },
    // For bank accounts
    accountNumber: {
      type: String,
      trim: true,
    },
    routingNumber: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    accountHolderName: {
      type: String,
      trim: true,
    },
    // For PayPal
    paypalEmail: {
      type: String,
      trim: true,
    },
    // For Stripe
    stripeAccountId: {
      type: String,
      trim: true,
    },
    // For Crypto
    walletAddress: {
      type: String,
      trim: true,
    },
    cryptoType: {
      type: String,
      trim: true,
    },
    // For other payment methods
    details: {
      type: String,
      trim: true,
    },
  },
  { _id: false } // Don't create separate _id for sub-documents
);

const withdrawSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    affiliateId: {
      type: Schema.Types.ObjectId,
      ref: "Affiliate",
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "DENIED", "PAID"],
      default: "PENDING",
      required: true,
    },
    // Payment method details for this withdrawal
    paymentMethod: {
      type: paymentMethodSchema,
      required: true,
    },
    // For account withdrawals (trading account payouts)
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    // Dates
    requestedDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    processedDate: {
      type: Date,
      default: null, // Set when approved/denied/paid
    },
    // Optional notes/comments
    notes: {
      type: String,
      trim: true,
    },
    // Transaction ID or reference (for tracking payments)
    transactionRef: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for better query performance
withdrawSchema.index({ userId: 1, status: 1 });
withdrawSchema.index({ affiliateId: 1, status: 1 });
withdrawSchema.index({ requestedDate: -1 });

// Export both the schema and model for flexibility
module.exports = {
  paymentMethodSchema,
  Withdraw: mongoose.model("Withdraw", withdrawSchema),
};
