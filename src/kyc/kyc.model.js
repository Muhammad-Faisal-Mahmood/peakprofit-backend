const mongoose = require("mongoose");

const kycSchema = mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    legalName: {
      type: String,
      required: true,
    },
    socials: {
      type: String,
      required: true,
    },
    idFrontImage: {
      type: String,
      required: true,
    },
    idBackImage: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

kycSchema.index({ status: 1 });

module.exports = mongoose.model("KYC", kycSchema);
