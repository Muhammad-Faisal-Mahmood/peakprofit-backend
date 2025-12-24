const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const createAccount = require("../../utils/createAccount");
const sendAccountActivationEmail = require("../../utils/sendAccountActivationEmail");
const { sendLiveAccountEmail } = require("../../utils/sendLiveAccountEmail");
const giveUserTradingAccounts = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized: Admins only.");
    }
    const { userId, accountSize, accountType, profit } = req.body;

    if (!userId || !accountSize) {
      return sendErrorResponse(res, "missing parameters in the body");
    }

    // Convert and validate accountSize
    const accountSizeNum = Number(accountSize);
    if (isNaN(accountSizeNum)) {
      return sendErrorResponse(res, "accountSize must be a valid number");
    }
    if (accountSizeNum < 0) {
      return sendErrorResponse(res, "accountSize cannot be negative");
    }

    // Convert and validate profit (if provided)
    let profitNum = 0;
    if (profit !== undefined && profit !== null && profit !== "") {
      profitNum = Number(profit);
      if (isNaN(profitNum)) {
        return sendErrorResponse(res, "profit must be a valid number");
      }
      if (profitNum < 0) {
        return sendErrorResponse(res, "profit cannot be negative");
      }
    }

    const createdAccount = await createAccount({
      userId,
      challengeId: null,
      accountType,
      accountSize: accountSizeNum,
      profit: profitNum,
    });

    if (accountType === "demo") {
      await sendAccountActivationEmail(createdAccount, userId);
    } else if (accountType === "live") {
      await sendLiveAccountEmail(createdAccount._id);
    }

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
