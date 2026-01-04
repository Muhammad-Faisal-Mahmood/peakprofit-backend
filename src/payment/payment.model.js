const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    /* -------------------- CORE REFERENCES -------------------- */
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

    /* -------------------- AUTHORIZE.NET IDS -------------------- */
    transactionId: {
      type: String,
      unique: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      index: true,
    },

    /* -------------------- STATUS -------------------- */
    status: {
      type: String,
      enum: ["pending", "accepted", "failed"],
      default: "pending",
      index: true,
    },

    /* -------------------- AMOUNTS -------------------- */
    authAmount: {
      type: Number,
      required: true,
    },

    settledAmount: {
      type: Number,
    },

    currency: {
      type: String,
      default: "USD",
    },

    /* -------------------- RESPONSE INFO -------------------- */
    responseCode: Number,
    responseReasonCode: Number,
    responseReasonDescription: String,
    authCode: String,

    avsResponse: String,
    cardCodeResponse: String,

    /* -------------------- PAYMENT METHOD -------------------- */
    paymentMethodType: {
      type: String,
      enum: ["card", "bank_account"],
    },

    /* ---- CARD ---- */
    card: {
      brand: String, // Visa, MasterCard, Amex
      last4: String, // XXXX0002
      expirationDate: String,
    },

    /* ---- BANK / ACH ---- */
    bank: {
      accountType: String, // checking / savings
      routingNumberMasked: String,
      accountNumberMasked: String,
      nameOnAccount: String,
      bankName: String,
    },

    /* -------------------- BILLING INFO -------------------- */
    billingAddress: {
      firstName: String,
      lastName: String,
      address: String,
      city: String,
      state: String,
      zip: String,
      country: String,
      phoneNumber: String,
    },

    /* -------------------- ORDER INFO -------------------- */
    orderDescription: String,

    /* -------------------- NETWORK / META -------------------- */
    customerIP: String,
    networkTransId: String,
    marketType: String,
    product: String,

    /* -------------------- TIMESTAMPS FROM AUTH.NET -------------------- */
    submitTimeUTC: Date,
    submitTimeLocal: Date,

    /* -------------------- INTERNAL METADATA -------------------- */
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

/* -------------------- INDEXES -------------------- */
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ challengeId: 1 });
paymentSchema.index({ invoiceNumber: 1 });
paymentSchema.index({ transId: 1 });

/* -------------------- HELPERS -------------------- */
paymentSchema.methods.isSuccessful = function () {
  return this.status === "accepted";
};

paymentSchema.methods.isFailed = function () {
  return this.status === "failed";
};

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;
