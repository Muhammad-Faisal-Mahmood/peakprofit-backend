const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const createAccount = require("../../utils/createAccount");
const giveUserTradingAccounts = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized: Admins only.");
    }
    const { userId, accountSize, accountType } = req.body;
    console.log("user id in give trading accs", userId);

    if (!userId || !accountSize) {
      return sendErrorResponse(res, "missing parameters in the body");
    }

    const createdAccount = await createAccount({
      userId,
      challengeId: null,
      accountType,
      accountSize,
    });
    return sendSuccessResponse(
      res,
      "Account given successfully",
      createdAccount
    );
  } catch (error) {
    return sendErrorResponse(res, error.message);
  }
};

module.exports = giveUserTradingAccounts;
