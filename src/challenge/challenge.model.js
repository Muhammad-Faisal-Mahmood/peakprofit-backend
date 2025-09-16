const mongoose = require("mongoose");

const { Schema } = mongoose;

const challengeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    cost: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Challenge", challengeSchema);
