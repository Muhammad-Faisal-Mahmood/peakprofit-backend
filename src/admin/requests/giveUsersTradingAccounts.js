const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const createAccount = require("../../utils/createAccount");
const sendAccountActivationEmail = require("../../utils/sendAccountActivationEmail");
const giveUserTradingAccounts = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized: Admins only.");
    }
    const { userId, accountSize, accountType } = req.body;

    if (!userId || !accountSize) {
      return sendErrorResponse(res, "missing parameters in the body");
    }

    const createdAccount = await createAccount({
      userId,
      challengeId: null,
      accountType,
      accountSize,
    });

    await sendAccountActivationEmail(createdAccount, userId);

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
