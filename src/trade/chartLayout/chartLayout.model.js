// models/ChartLayout.js
const mongoose = require("mongoose");

const chartLayoutSchema = new mongoose.Schema({
  // User identification
  userId: {
    type: String,
    required: true,
    index: true,
  },

  // Chart identification
  chartId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },

  // Chart metadata
  name: {
    type: String,
    required: true,
  },
  symbol: {
    type: String,
    required: true,
  },
  resolution: {
    type: String,
    required: true,
  },

  // The actual chart state (includes drawings, indicators, everything)
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },

  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for faster queries
chartLayoutSchema.index({ userId: 1 });

module.exports = mongoose.model("ChartLayout", chartLayoutSchema);
