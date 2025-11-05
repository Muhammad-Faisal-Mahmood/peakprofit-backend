const Watchlist = require("../watchlist.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");

// Remove item from watchlist
async function removeFromWatchlist(req, res) {
  try {
    const { symbol } = req.params;
    const userId = req.user.userId;

    if (!symbol) {
      return sendErrorResponse(res, "Symbol is required.");
    }

    const watchlist = await Watchlist.findOne({ userId });

    if (!watchlist) {
      return sendErrorResponse(res, "Watchlist not found.");
    }

    await watchlist.removeItem(symbol);

    return sendSuccessResponse(
      res,
      "Item removed from watchlist successfully.",
      watchlist
    );
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    if (error.message === "Symbol not found in watchlist") {
      return sendErrorResponse(res, error.message);
    }
    return sendErrorResponse(
      res,
      "Something went wrong while removing from watchlist."
    );
  }
}

module.exports = removeFromWatchlist;
