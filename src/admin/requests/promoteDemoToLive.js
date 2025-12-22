const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const {
  promoteAccountToLive,
} = require("../../utils/accountPromotion.service");
const Account = require("../../trade/account/account.model");

const promoteDemoToLive = async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized: Admins only.");
    }
    const { accountId } = req.body;
    if (!accountId) {
      return sendErrorResponse(res, "accountId is required");
    }

    const account = await Account.findById(accountId);
    if (!account) {
      return sendErrorResponse(res, "Demo account not found");
    }
    if (account.accountType !== "demo") {
      return sendErrorResponse(res, "Account is not a demo account");
    }
    if (account.liveAccountId) {
      return sendErrorResponse(res, "Demo account is already promoted to live");
    }
    if (account.status !== "active") {
      return sendErrorResponse(
        res,
        "Only active demo accounts can be promoted to live"
      );
    }

    const promoted = await promoteAccountToLive(accountId, "adminPromotion");
    sendSuccessResponse(res, "Demo account promoted to live successfully.", {
      sucess: promoted?.success,
      newLiveAccountId: promoted?.accountId,
    });
  } catch (error) {
    sendErrorResponse(res, "Couldn't promote demo to live");
  }
};

module.exports = promoteDemoToLive;
