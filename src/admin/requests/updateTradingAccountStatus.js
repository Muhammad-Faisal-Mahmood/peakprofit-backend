const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const Account = require("../../trade/account/account.model");
const accountLiquidatorWrapper = require("../../utils/accountLiquidatorWrapper");

const updateTradingAccountStatus = async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return sendErrorResponse(
        res,
        "Access denied. Admin privileges required."
      );
    }

    const { accountId, status } = req.body;
    if (!accountId || !status) {
      return sendErrorResponse(res, "Account ID and status are required.");
    }
    const account = await Account.findById(accountId);
    if (!account) {
      return sendErrorResponse(res, "Trading account not found.");
    }

    if (["active", "suspended"].includes(status) === false) {
      return sendErrorResponse(res, "Invalid status value.");
    }

    if (account.status === status) {
      return sendErrorResponse(
        res,
        `Account is already in '${status}' status.`
      );
    }
    account.status = status;
    const updatedAccount = await account.save();

    if (status === "suspended") {
      await accountLiquidatorWrapper(accountId, "accountSuspended", null, null);
    }

    sendSuccessResponse(
      res,
      "Trading account status updated successfully.",
      updatedAccount
    );
  } catch (error) {
    sendErrorResponse(res, "Couldn't update trading account status.");
  }
};
module.exports = updateTradingAccountStatus;
