const mongoose = require("mongoose");

const paymentSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "expired", "failed", "completed"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

const PaymentSession = mongoose.model("PaymentSession", paymentSessionSchema);
module.exports = PaymentSession;
