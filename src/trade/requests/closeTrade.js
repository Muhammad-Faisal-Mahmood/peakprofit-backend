// controllers/trade/requests/closeTrade.js
const Trade = require("../trade.model");
const Account = require("../account/account.model");
const TradeMonitor = require("../tradeMonitor.service");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const closeTrade = async (req, res) => {
  try {
    const { tradeId, price } = req.body;
    const userId = req.user.userId;

    if (!tradeId || !price) {
      return sendErrorResponse(
        res,
        "Missing required parameters: tradeId, price"
      );
    }

    // Fetch the trade
    const trade = await Trade.findById(tradeId);
    if (!trade) {
      return sendErrorResponse(res, "Trade not found.");
    }

    // Ensure trade belongs to this user
    if (trade.userId.toString() !== userId.toString()) {
      return sendErrorResponse(
        res,
        "You are not authorized to close this trade."
      );
    }

    // Ensure trade is open
    if (trade.status === "closed") {
      return sendErrorResponse(res, "Trade is already closed.");
    }

    // Call the closeTrade method in TradeMonitor
    const closeResult = await TradeMonitor.closeTrade(
      trade,
      price,
      "userClosed"
    );

    // Remove it from monitoring
    TradeMonitor.removeTradeFromMonitoring(tradeId, trade.accountId.toString());

    return sendSuccessResponse(
      res,
      "Trade closed successfully by user.",
      closeResult
    );
  } catch (err) {
    console.error("[closeTrade] Error closing trade:", err);
    return sendErrorResponse(res, "Failed to close trade.", err.message);
  }
};

module.exports = closeTrade;
