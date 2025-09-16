const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    email: { type: String, required: true },
    name: { type: String },
    password: { type: String },
    profilePicture: { type: String, default: "default.jpg" },
    resetToken: { type: Number, default: null },
    resetTokenExpiration: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    role: { type: String, enum: ["Admin", "User"], default: "User" },
    affiliateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Affiliate",
      default: null,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // The user who referred this user (not the affiliate document)
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
