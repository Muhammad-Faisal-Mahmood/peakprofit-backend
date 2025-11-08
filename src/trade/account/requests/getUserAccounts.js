const Account = require("../account.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");
require("../../trade.model");

// 1️⃣ Get all accounts of a specific user
async function getUserAccounts(req, res) {
  try {
    const userId = req.user.userId || req.params.userId;

    if (!userId) {
      return sendErrorResponse(res, "User ID is required.");
    }

    const accounts = await Account.find({ userId })
      .populate("openPositions")
      .populate("closedPositions")
      .populate("challengeId", "name cost accountSize") // optional fields from Challenge
      .sort({ createdAt: -1 });

    return sendSuccessResponse(res, "Accounts fetched successfully.", accounts);
  } catch (error) {
    console.error("Error fetching user accounts:", error);
    return sendErrorResponse(res, "Failed to fetch user accounts.");
  }
}

module.exports = getUserAccounts;
