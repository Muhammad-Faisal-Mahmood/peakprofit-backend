const Watchlist = require("../watchlist.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");

// Add item to watchlist
async function addToWatchlist(req, res) {
  try {
    const { symbol, name, type, channel, market, polygonSymbol } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!symbol || !name || !type || !channel || !market || !polygonSymbol) {
      return sendErrorResponse(res, "All fields are required.");
    }

    // Find or create watchlist for user
    let watchlist = await Watchlist.findOne({ userId });

    if (!watchlist) {
      watchlist = new Watchlist({ userId, items: [] });
    }

    // Add item to watchlist
    const itemData = {
      symbol: symbol.toUpperCase(),
      name,
      type,
      channel,
      market,
      polygonSymbol,
    };

    await watchlist.addItem(itemData);

    return sendSuccessResponse(
      res,
      "Item added to watchlist successfully.",
      watchlist
    );
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    if (error.message === "Symbol already exists in watchlist") {
      return sendErrorResponse(res, error.message);
    }
    return sendErrorResponse(
      res,
      "Something went wrong while adding to watchlist."
    );
  }
}

module.exports = addToWatchlist;
