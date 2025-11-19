const mongoose = require("mongoose");

const ChartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
  interval: {
    type: String,
    enum: ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1mo"],
  },
});

module.exports = mongoose.model("Chart", ChartSchema);
