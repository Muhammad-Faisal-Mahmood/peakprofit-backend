const mongoose = require("mongoose");

const affiliateApplicationSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    strategy: { type: String, required: true },
    socialMediaLink: { type: String, required: true },
    websiteLink: { type: String, required: true },
    status: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "rejected", "accepted"],
      lowercase: true, // Mongoose will always store in lowercase
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "AffiliateApplications",
  affiliateApplicationSchema
);
