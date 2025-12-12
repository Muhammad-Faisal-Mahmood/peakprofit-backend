const { Withdraw } = require("../../withdraw/withdraw.model");
const Account = require("../../trade/account/account.model");
const { sendSuccessResponse, sendErrorResponse } = require("../../shared/response.service");

const getTradingPayoutsHistory = async (req, res) => {
  try {
    const userId = req.user.userId;

    const withdrawals = await Withdraw.find({
      userId: userId,
      accountId: { $ne: null }, // Only trading withdrawals
    })
      .populate({
        path: "accountId",
        model: "Account",
      })
      .sort({ requestedDate: -1 });

    // If you want to rename accountId → account and keep it clean:
    const formatted = withdrawals.map((w) => {
      const obj = w.toObject();
      obj.account = obj.accountId; // Rename
      delete obj.accountId;        // Remove original
      return obj;
    });

    return sendSuccessResponse(
      res,
      "Trading withdrawals fetched successfully",
      {
        count: formatted.length,
        withdrawals: formatted,
      }
    );
  } catch (error) {
    console.error("Error fetching trading withdrawals:", error);
    return sendErrorResponse(res, "Failed to fetch trading withdrawals");
  }
};

module.exports = getTradingPayoutsHistory;
