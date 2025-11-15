const Account = require("../account.model");
const SelectedAccount = require("../selectedAccount.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");

async function setSelectedAccount(req, res) {
  try {
    const userId = req.user.userId;
    const { accountId } = req.body;

    if (!accountId) {
      return sendErrorResponse(res, "Account ID is required.");
    }

    // Verify that the account exists and belongs to the user
    const account = await Account.findOne({
      _id: accountId,
      userId: userId,
    });

    if (!account) {
      return sendErrorResponse(
        res,
        "Account not found or does not belong to you."
      );
    }

    // Update or create selected account
    const selectedAccount = await SelectedAccount.findOneAndUpdate(
      { userId: userId },
      { accountId: accountId },
      {
        upsert: true, // Create if doesn't exist
        new: true, // Return updated document
        runValidators: true,
      }
    ).populate("accountId");

    let transformedSelectedAccount = null;

    if (selectedAccount) {
      const sel = selectedAccount.toObject();
      sel.account = sel.accountId; // rename
      delete sel.accountId; // remove old key
      transformedSelectedAccount = sel;
    }

    return sendSuccessResponse(
      res,
      "Account selected successfully.",
      transformedSelectedAccount
    );
  } catch (error) {
    console.error("Error setting selected account:", error);

    if (error.name === "ValidationError") {
      return sendErrorResponse(res, "Invalid account data.");
    }

    return sendErrorResponse(res, "Failed to set selected account.");
  }
}

module.exports = setSelectedAccount;
