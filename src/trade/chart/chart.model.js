const mongoose = require("mongoose");

const ChartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
  interval: {
    type: String,
    enum: [
      "1",
      "2",
      "3",
      "4",
      "5",
      "10",
      "15",
      "30",
      "60",
      "120",
      "240",
      "300",

      "1D",
      "2D",
      "3D",
      "1W",
      "1M",
    ],
    default: "1",
  },
});

module.exports = mongoose.model("Chart", ChartSchema);
