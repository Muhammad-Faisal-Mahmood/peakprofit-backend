const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const Account = require("../../trade/account/account.model");
const Trade = require("../../trade/trade.model");
const { Withdraw } = require("../../withdraw/withdraw.model");
const getTradingAccountDetails = async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return sendErrorResponse(
        res,
        "Access denied. Admin privileges required."
      );
    }
    const { accountId } = req.params;
    if (!accountId) {
      return sendErrorResponse(res, "Account ID is required");
    }
    const account = await Account.findById(accountId)
      .populate("userId", "name email") // Populate user details
      .populate("challengeId") // Populate challenge details if needed
      .lean();

    if (!account) {
      return sendErrorResponse(res, "Trading account not found");
    }

    // Fetch all trades for this account
    const allTrades = await Trade.find({ accountId })
      .sort({ createdAt: -1 }) // Most recent first
      .lean();

    // Separate trades by status
    const openTrades = allTrades.filter((trade) => trade.status === "open");
    const closedTrades = allTrades.filter((trade) => trade.status === "closed");
    const pendingTrades = allTrades.filter(
      (trade) => trade.status === "pending"
    );
    const cancelledTrades = allTrades.filter(
      (trade) => trade.status === "cancelled"
    );

    // Fetch payout history
    const payoutHistory = await Withdraw.find({
      accountId,
    })
      .sort({ requestedDate: -1 })
      .lean();

    // Calculate trading statistics
    const totalPnL = closedTrades.reduce(
      (sum, trade) => sum + (trade.pnl || 0),
      0
    );
    const winningTrades = closedTrades.filter((trade) => trade.pnl > 0);
    const losingTrades = closedTrades.filter((trade) => trade.pnl < 0);
    const winRate =
      closedTrades.length > 0
        ? (winningTrades.length / closedTrades.length) * 100
        : 0;

    // Prepare response
    const accountDetails = {
      account: {
        ...account,
        // Override with populated arrays
        openPositions: openTrades,
        closedPositions: closedTrades,
        pendingOrders: pendingTrades,
        cancelledOrders: cancelledTrades,
        payoutHistory,
      },
      statistics: {
        totalTrades: allTrades.length,
        openTrades: openTrades.length,
        closedTrades: closedTrades.length,
        pendingOrders: pendingTrades.length,
        cancelledOrders: cancelledTrades.length,
        totalPnL,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: winRate.toFixed(2),
        totalPayouts: payoutHistory.length,
        totalPayoutAmount: account.totalPayoutAmount || 0,
      },
    };

    const user = accountDetails.account.userId;
    delete accountDetails.account.userId;
    accountDetails.account.user = user;
    return sendSuccessResponse(
      res,
      "Trading account details retrieved successfully",
      accountDetails
    );
  } catch (error) {
    console.error("Error fetching trading account details:", error);
    return sendErrorResponse(res, "Failed to retrieve trading account details");
  }
};

module.exports = getTradingAccountDetails;
