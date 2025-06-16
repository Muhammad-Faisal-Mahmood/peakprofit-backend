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
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
