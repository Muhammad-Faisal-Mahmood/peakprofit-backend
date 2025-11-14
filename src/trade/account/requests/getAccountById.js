const Account = require("../account.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");
require("../../trade.model");

async function getAccountById(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return sendErrorResponse(res, "Account ID is required.");
    }

    const account = await Account.findById(id)
      .populate("openPositions")
      .populate("closedPositions")
      .populate("pendingOrders")
      .populate("cancelledOrders")
      .populate({
        path: "challengeId",
        select: "name cost accountSize",
      });

    if (!account) {
      return sendErrorResponse(res, "Account not found.");
    }

    // Transform the response to rename challengeId to challenge
    const accountObj = account.toObject();
    accountObj.challenge = accountObj.challengeId;
    delete accountObj.challengeId;

    return sendSuccessResponse(
      res,
      "Account fetched successfully.",
      accountObj
    );
  } catch (error) {
    console.error("Error fetching account by ID:", error);
    return sendErrorResponse(res, "Failed to fetch account.");
  }
}

module.exports = getAccountById;
