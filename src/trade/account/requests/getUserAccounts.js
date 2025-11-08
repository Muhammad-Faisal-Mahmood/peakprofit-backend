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
      .populate({
        path: "challengeId",
        select: "name cost accountSize",
      })
      .sort({ createdAt: -1 });

    // Transform the response to rename challengeId to challenge
    const transformedAccounts = accounts.map((account) => {
      const accountObj = account.toObject();
      accountObj.challenge = accountObj.challengeId;
      delete accountObj.challengeId;
      return accountObj;
    });

    return sendSuccessResponse(
      res,
      "Accounts fetched successfully.",
      transformedAccounts
    );
  } catch (error) {
    console.error("Error fetching user accounts:", error);
    return sendErrorResponse(res, "Failed to fetch user accounts.");
  }
}

module.exports = getUserAccounts;
