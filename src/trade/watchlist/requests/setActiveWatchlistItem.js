const Watchlist = require("../watchlist.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");

// Set active item in watchlist
async function setActiveWatchlistItem(req, res) {
  try {
    const { symbol, name, type, channel, market, polygonSymbol } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!symbol || !name || !type || !channel || !market || !polygonSymbol) {
      return sendErrorResponse(res, "All fields are required.");
    }

    // Find or create user's watchlist
    let watchlist = await Watchlist.findOne({ userId });

    if (!watchlist) {
      watchlist = new Watchlist({ userId, items: [] });
    }

    // Build item data
    const itemData = {
      symbol: symbol.toUpperCase(),
      name,
      type,
      channel,
      market,
      polygonSymbol,
    };

    // Set the active item
    watchlist.activeItem = itemData;
    watchlist.lastUpdated = new Date();

    await watchlist.save();

    return sendSuccessResponse(
      res,
      "Active item set successfully.",
      watchlist.activeItem
    );
  } catch (error) {
    console.error("Error setting active item:", error);
    return sendErrorResponse(
      res,
      "Something went wrong while setting active item."
    );
  }
}

module.exports = setActiveWatchlistItem;
