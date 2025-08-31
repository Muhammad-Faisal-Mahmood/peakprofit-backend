const mongoose = require("mongoose");

const { Schema } = mongoose;

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
    referrals: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    earnings: {
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Affiliate", affiliateSchema);
