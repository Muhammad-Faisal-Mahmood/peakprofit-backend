const Trade = require("../trade.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const redis = require("../../utils/redis.helper");

const editTrade = async (req, res) => {
  try {
    const { tradeId, stopLoss, takeProfit } = req.body;
    const userId = req.user.userId;
    if (!userId) return sendErrorResponse(res, "Unauthorized");
    if (!tradeId) return sendErrorResponse(res, "Trade Id is required");

    if (!stopLoss && !takeProfit)
      return sendErrorResponse(res, "Stop loss or take profit is required");

    const trade = await Trade.findById(tradeId);

    if (!trade) return sendErrorResponse(res, "Couldn't find trade");

    console.log("trade.userId", trade.userId);
    console.log("user.userId", userId);
    if (trade.userId.toString() !== userId)
      return sendErrorResponse(res, "Unauthorized to update trade");

    if (trade.status == "cancelled" || trade.status == "closed") {
      return sendErrorResponse(
        res,
        "Can't update trades with status: " + trade.status
      );
    }
    if (stopLoss) trade.stopLoss = stopLoss;

    if (takeProfit) trade.takeProfit = takeProfit;

    await trade.save();

    await redis.setOpenTrade(tradeId, {
      _id: tradeId,
      accountId: trade.accountId.toString(),
      userId: trade.userId.toString(),
      symbol: trade.symbol,
      side: trade.side,
      tradeSize: trade.tradeSize,
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      market: trade.market,
    });

    return sendSuccessResponse(res, "Trade updated successfully", trade);
  } catch (error) {
    console.log("error updating trade:", error);
    return sendErrorResponse(res, "Couldn't update trade");
  }
};

module.exports = editTrade;
