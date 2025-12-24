const Trade = require("../trade.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const closeTradeService = require("../../utils/closeTrade.service");
const redisTradeCleanup = require("../../utils/redisTradeCleanup");
const sendLiveAccountEmail = require("../../utils/sendLiveAccountEmail");

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

    // Call the closeTrade service
    const result = await closeTradeService(trade, price, "userClosed");

    // ✅ Check if account was promoted
    if (result && result.promoted) {
      console.log(
        ` [closeTrade Controller] Account promoted! Skipping Redis cleanup.`
      );

      await sendLiveAccountEmail(result.accountId);
      return sendSuccessResponse(
        res,
        "🎉 Congratulations! You passed the challenge. Your account has been promoted to LIVE trading with a fresh start!",
        result
      );
    }

    // Normal trade closure - cleanup Redis
    await redisTradeCleanup({
      tradeId: trade._id.toString(),
      accountId: trade.accountId.toString(),
      symbol: trade.symbol,
      market: trade.market,
    });

    if (result) {
      return sendSuccessResponse(
        res,
        "Trade closed successfully by user.",
        result
      );
    } else {
      throw new Error("trade received: ", result);
    }
  } catch (err) {
    console.error("[closeTrade] Error closing trade:", err);
    return sendErrorResponse(res, "Failed to close trade.", err.message);
  }
};

module.exports = closeTrade;
