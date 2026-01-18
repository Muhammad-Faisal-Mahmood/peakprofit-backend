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

    if (stopLoss === undefined && takeProfit === undefined)
      return sendErrorResponse(res, "Stop loss or take profit is required");

    if (
      (stopLoss !== undefined &&
        stopLoss !== null &&
        !isValidNumber(stopLoss)) ||
      (takeProfit !== undefined &&
        takeProfit !== null &&
        !isValidNumber(takeProfit))
    ) {
      return sendErrorResponse(
        res,
        "Stop loss and take profit must be numbers"
      );
    }

    const trade = await Trade.findById(tradeId);

    if (!trade) return sendErrorResponse(res, "Couldn't find trade");

    if (trade.userId.toString() !== userId)
      return sendErrorResponse(res, "Unauthorized to update trade");

    if (trade.status == "cancelled" || trade.status == "closed") {
      return sendErrorResponse(
        res,
        "Can't update trades with status: " + trade.status
      );
    }
    if (stopLoss === null) {
      trade.stopLoss = undefined;
    } else {
      trade.stopLoss = stopLoss;
    }

    if (takeProfit === null) {
      trade.takeProfit = undefined;
    } else {
      trade.takeProfit = takeProfit;
    }

    await trade.save();

    const redisTrade = {
      _id: trade._id.toString(),
      accountId: trade.accountId.toString(),
      userId: trade.userId.toString(),
      symbol: trade.symbol,
      side: trade.side,
      tradeSize: trade.tradeSize,
      entryPrice: trade.entryPrice,
      market: trade.market,
      units: trade.units,
      tradeSize: trade.units * trade.entryPrice * 50,
    };

    // Only include if they exist in Mongo
    if (trade.stopLoss !== undefined) {
      redisTrade.stopLoss = trade.stopLoss;
    }

    if (trade.takeProfit !== undefined) {
      redisTrade.takeProfit = trade.takeProfit;
    }

    await redis.setOpenTrade(trade._id.toString(), redisTrade);

    const updatedRedisTrade = await redis.getOpenTrade(trade._id.toString());
    console.log("updated redis trade: ", updatedRedisTrade);

    return sendSuccessResponse(res, "Trade updated successfully", trade);
  } catch (error) {
    console.log("error updating trade:", error);
    return sendErrorResponse(res, "Couldn't update trade");
  }
};

const isValidNumber = (value) =>
  typeof value === "number" && !Number.isNaN(value);

module.exports = editTrade;
