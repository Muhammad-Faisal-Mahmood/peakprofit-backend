const Watchlist = require("../watchlist.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");

// Get active item from watchlist
async function getActiveWatchlistItem(req, res) {
  try {
    const userId = req.user.userId;

    const watchlist = await Watchlist.findOne({ userId });

    if (!watchlist) {
      return sendErrorResponse(res, "Watchlist not found for this user.");
    }

    if (!watchlist.activeItem) {
      return sendErrorResponse(res, "No active item set in watchlist.");
    }

    return sendSuccessResponse(
      res,
      "Active item fetched successfully.",
      watchlist.activeItem
    );
  } catch (error) {
    console.error("Error fetching active watchlist item:", error);
    return sendErrorResponse(
      res,
      "Something went wrong while fetching active item."
    );
  }
}

module.exports = getActiveWatchlistItem;
