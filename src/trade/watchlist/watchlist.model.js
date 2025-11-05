const mongoose = require("mongoose");

const WatchlistItemSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["forex", "crypto", "stock", "index"],
    required: true,
  },
  channel: {
    type: String,
    enum: ["C", "XT", "T", "A", "AM"],
    required: true,
  },
  market: {
    type: String,
    enum: ["crypto", "forex", "stock"],
    required: true,
  },
  polygonSymbol: {
    type: String,
    required: true,
    trim: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const WatchlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [WatchlistItemSchema],
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
WatchlistSchema.index({ userId: 1 });
WatchlistSchema.index({ "items.symbol": 1 });

// Static method to get watchlist by user ID
WatchlistSchema.statics.findByUserId = function (userId) {
  return this.findOne({ userId }).populate("userId", "username email");
};

// Instance method to add item to watchlist
WatchlistSchema.methods.addItem = function (itemData) {
  const existingItem = this.items.find(
    (item) => item.symbol === itemData.symbol
  );

  if (existingItem) {
    throw new Error("Symbol already exists in watchlist");
  }

  this.items.push(itemData);
  this.lastUpdated = new Date();
  return this.save();
};

// Instance method to remove item from watchlist
WatchlistSchema.methods.removeItem = function (symbol) {
  const initialLength = this.items.length;
  this.items = this.items.filter(
    (item) => item.symbol !== symbol.toUpperCase()
  );

  if (this.items.length === initialLength) {
    throw new Error("Symbol not found in watchlist");
  }

  this.lastUpdated = new Date();
  return this.save();
};

// Instance method to check if symbol exists
WatchlistSchema.methods.hasSymbol = function (symbol) {
  return this.items.some((item) => item.symbol === symbol.toUpperCase());
};

module.exports = mongoose.model("Watchlist", WatchlistSchema);
