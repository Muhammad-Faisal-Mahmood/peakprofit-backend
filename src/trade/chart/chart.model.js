const mongoose = require("mongoose");

const ChartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
  interval: {
    type: String,
    enum: ["1", "5", "15", "30", "60", "240", "1D", "1W", "1M"],
    default: "1",
  },
});

module.exports = mongoose.model("Chart", ChartSchema);
