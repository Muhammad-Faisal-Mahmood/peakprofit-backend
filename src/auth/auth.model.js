const mongoose = require("mongoose");

const authSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    authCode: {
      type: Number,
      // Make it not required so we can remove it after verification
      required: false,
    },
    status: {
      type: Boolean,
      default: false,
    },
    expiration: {
      type: Date,
      // Make it not required so we can remove it after verification
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("TwoFactorAuth", authSchema);
