const Account = require("../account.model");
const SelectedAccount = require("../selectedAccount.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");
require("../../trade.model");

// 1️⃣ Get all accounts of a specific user
async function getUserAccounts(req, res) {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return sendErrorResponse(res, "User ID is required.");
    }

    // Get all accounts for the user
    const accounts = await Account.find({ userId })
      .populate("openPositions")
      .populate("closedPositions")
      .populate("pendingOrders")
      .populate("cancelledOrders")
      .populate({
        path: "challengeId",
        select: "name cost accountSize",
      })
      .sort({ createdAt: -1 });

    // Get selected account for the user
    const selectedAccount = await SelectedAccount.findOne({ userId }).populate(
      "accountId"
    );

    // Transform the response to rename challengeId to challenge and add selected flag
    const transformedAccounts = accounts.map((account) => {
      const accountObj = account.toObject();
      accountObj.challenge = accountObj.challengeId;
      delete accountObj.challengeId;

      return accountObj;
    });

    let transformedSelectedAccount = null;

    if (selectedAccount) {
      const sel = selectedAccount.toObject();
      sel.account = sel.accountId; // rename
      delete sel.accountId; // remove old key
      transformedSelectedAccount = sel;
    }

    // Prepare response with selected account info
    const response = {
      accounts: transformedAccounts,
      selectedAccount: selectedAccount ? transformedSelectedAccount : null,
    };

    return sendSuccessResponse(res, "Accounts fetched successfully.", response);
  } catch (error) {
    console.error("Error fetching user accounts:", error);
    return sendErrorResponse(res, "Failed to fetch user accounts.");
  }
}

module.exports = getUserAccounts;
