const Watchlist = require("../watchlist.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");
const defaultInstruments = require("../../../utils/defaultInstruments"); // <-- path to your defaults

// Get user's watchlist (auto-create default if not found)
async function getWatchlist(req, res) {
  try {
    const userId = req.user.userId;

    let watchlist = await Watchlist.findByUserId(userId);

    // ✅ If watchlist does not exist, create one with defaults
    if (!watchlist) {
      watchlist = new Watchlist({
        userId,
        items: defaultInstruments,
      });

      await watchlist.save();

      return sendSuccessResponse(res, "Default watchlist created.", watchlist);
    }

    // ✅ If watchlist exists, return it as usual
    return sendSuccessResponse(
      res,
      "Watchlist fetched successfully.",
      watchlist
    );
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return sendErrorResponse(
      res,
      "Something went wrong while fetching watchlist."
    );
  }
}

module.exports = getWatchlist;
