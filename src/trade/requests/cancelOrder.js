const Trade = require("../trade.model");
const Account = require("../account/account.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const TradeMonitor = require("../tradeMonitor.service");

const cancelPendingOrder = async (req, res) => {
  try {
    const { tradeId } = req.body;
    const userId = req.user.userId;

    const order = await Trade.findById(tradeId);
    if (!order) {
      return sendErrorResponse(res, "Order not found.");
    }

    if (order.userId.toString() !== userId) {
      return sendErrorResponse(res, "Unauthorized to cancel this order.");
    }

    if (order.status !== "pending") {
      return sendErrorResponse(
        res,
        `Cannot cancel order with status: ${order.status}`
      );
    }

    await TradeMonitor.cancelPendingOrder(
      tradeId,
      order.accountId.toString(),
      order.symbol,
      "userCancelled"
    );

    return sendSuccessResponse(res, "Order cancelled successfully.");
  } catch (err) {
    console.error("Error cancelling order:", err);
    return sendErrorResponse(res, "Failed to cancel order.", err.message);
  }
};

module.exports = cancelPendingOrder;
