const { Withdraw } = require("../../withdraw/withdraw.model");
const Affiliate = require("../../affiliate/affiliate.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const Account = require("../../trade/account/account.model");
const User = require("../../user/user.model");
const path = require("path");
const { sendEmail } = require("../../shared/mail.service");

const updateWithdrawStatus = async (req, res) => {
  const VALID_STATUSES = ["APPROVED", "DENIED", "PAID"];

  try {
    // Ensure user is admin
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized - Admin access required");
    }

    const { withdrawId } = req.params;
    const { status, transactionRef } = req.body;

    // Validate status
    if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
      return sendErrorResponse(
        res,
        "Invalid status. Allowed values are: APPROVED, DENIED, PAID"
      );
    }

    const uppercaseStatus = status.toUpperCase();

    // Find the withdraw request
    const withdraw = await Withdraw.findById(withdrawId);

    if (!withdraw) {
      return sendErrorResponse(res, "Withdraw request not found");
    }

    // Define allowed status transitions
    const allowedTransitions = {
      PENDING: ["APPROVED", "DENIED", "PAID"], // PENDING can go to any status
      APPROVED: ["PAID", "DENIED"], // APPROVED can go to PAID or DENIED
      DENIED: [], // DENIED cannot be changed
      PAID: [], // PAID cannot be changed
    };

    // Check if the requested transition is allowed
    const currentStatus = withdraw.status;
    const allowedNextStatuses = allowedTransitions[currentStatus];

    if (!allowedNextStatuses.includes(uppercaseStatus)) {
      return sendErrorResponse(
        res,
        `Cannot change status from ${currentStatus} to ${uppercaseStatus}. ` +
          `Allowed transitions from ${currentStatus}: ${
            allowedNextStatuses.join(", ") || "NONE"
          }`
      );
    }

    // Update withdraw status and additional fields
    withdraw.status = uppercaseStatus;
    withdraw.processedDate = new Date();

    if (transactionRef && uppercaseStatus === "PAID") {
      withdraw.transactionRef = transactionRef;
    }

    // If this is an affiliate-related withdraw, process it through the affiliate system
    if (withdraw.affiliateId) {
      const affiliate = await Affiliate.findById(withdraw.affiliateId);

      if (!affiliate) {
        return sendErrorResponse(res, "Affiliate not found");
      }

      try {
        await affiliate.processWithdraw(
          withdrawId,
          withdraw.amount,
          uppercaseStatus
        );
      } catch (error) {
        return sendErrorResponse(res, error.message);
      }
    } else if (withdraw.accountId && uppercaseStatus === "DENIED") {
      const account = await Account.findById(withdraw.accountId);
      if (!account) {
        return sendErrorResponse(res, "Account not found for this withdraw");
      }
      await account.processRejectedPayout(withdraw.amount);
    } else if (withdraw.accountId && uppercaseStatus === "APPROVED") {
      const account = await Account.findById(withdraw.accountId);
      if (!account) {
        return sendErrorResponse(res, "Account not found for this withdraw");
      }
      const user = await User.findById(account.userId);
      if (!user) {
        return sendErrorResponse(res, "User not found for this account");
      }

      const replacementObject = {
        first_name: user.name.split(" ")[0],
        funded_account_size: account.initialBalance,
        funded_account_currency: "$",
        funded_account_type: account.accountType,
        server_name: "PeakMarkets-Live",
        payout_amount: withdraw.amount,
        payout_currency: "$",
        payout_method: withdraw.paymentMethod.type,
        payout_reference: transactionRef || "N/A",
        payout_date: withdraw.requestedDate,
        processing_time: "1-5 business days",
        trader_share: withdraw?.payable,
        firm_share: withdraw.amount - withdraw?.payable,
        total_withdrawn: account.totalPayoutAmount,
        total_account_profit:
          account.totalPayoutAmount + account.balance - account.initialBalance,
        remaining_profit: account.balance - account.initialBalance,
        year: new Date().getFullYear(),
        unsubscribe_url: "#",
        next_payout_date: new Date(
          new Date(account.lastPayoutDate).setDate(
            new Date(account.lastPayoutDate).getDate() + 5
          )
        ),
        scaling_eligible: "-",
      };

      await sendPayoutApprovalEmail(user.email, replacementObject);
    }

    // Save the updated withdraw
    await withdraw.save();

    // Populate the updated withdraw for response
    const updatedWithdraw = await Withdraw.findById(withdrawId)
      .populate({
        path: "userId",
        select: "name email",
      })
      .populate({
        path: "affiliateId",
        select: "affiliateId",
        populate: {
          path: "userId",
          select: "name email",
        },
      })
      .populate({
        path: "accountId",
        select: "accountType initialBalance balance equity status",
      })
      .lean();

    // Format the response
    const formattedWithdraw = {
      id: updatedWithdraw._id,
      amount: updatedWithdraw.amount,
      formattedAmount: `$${updatedWithdraw.amount.toFixed(2)}`,
      status: updatedWithdraw.status,
      requestedDate: updatedWithdraw.requestedDate,
      processedDate: updatedWithdraw.processedDate,
      notes: updatedWithdraw.notes,
      transactionRef: updatedWithdraw.transactionRef,
      affiliate: updatedWithdraw.affiliateId
        ? {
            id: updatedWithdraw.affiliateId._id,
            affiliateId: updatedWithdraw.affiliateId.affiliateId,
            name: updatedWithdraw.affiliateId.userId?.name,
            email: updatedWithdraw.affiliateId.userId?.email,
          }
        : null,
      user: updatedWithdraw.userId
        ? {
            id: updatedWithdraw.userId._id,
            name: updatedWithdraw.userId.name,
            email: updatedWithdraw.userId.email,
          }
        : null,
      account: updatedWithdraw?.accountId
        ? {
            id: updatedWithdraw.accountId._id,
            accountType: updatedWithdraw.accountId.accountType,
            initialBalance: updatedWithdraw.accountId.initialBalance,
            balance: updatedWithdraw.accountId.balance,
            equity: updatedWithdraw.accountId.equity,
            status: updatedWithdraw.accountId.status,
          }
        : null,

      paymentMethod: {
        type: updatedWithdraw.paymentMethod.type,
        accountNumber: updatedWithdraw.paymentMethod.accountNumber,
        routingNumber: updatedWithdraw.paymentMethod.routingNumber,
        bankName: updatedWithdraw.paymentMethod.bankName,
        accountHolderName: updatedWithdraw.paymentMethod.accountHolderName,
        paypalEmail: updatedWithdraw.paymentMethod.paypalEmail,
        stripeAccountId: updatedWithdraw.paymentMethod.stripeAccountId,
        walletAddress: updatedWithdraw.paymentMethod.walletAddress,
        cryptoType: updatedWithdraw.paymentMethod.cryptoType,
        details: updatedWithdraw.paymentMethod.details,
      },
    };

    return sendSuccessResponse(
      res,
      `Withdraw status updated from ${currentStatus} to ${uppercaseStatus} successfully`,
      formattedWithdraw
    );
  } catch (error) {
    console.error("Error updating withdraw status:", error);

    if (error.name === "CastError") {
      return sendErrorResponse(res, "Invalid withdraw ID format");
    }

    return sendErrorResponse(res, "Error updating withdraw status");
  }
};

async function sendPayoutApprovalEmail(email, replacements) {
  try {
    const template = path.join(
      __dirname,
      "..",
      "mails",
      "traderPayoutApproved.html"
    );

    await sendEmail(
      "Your Payout Has Been Approved ✔",
      template,
      email,
      replacements
    );

    console.log(`payout approval email sent to ${email}`);
  } catch (error) {
    console.error("Error sending KYC approval email:", error);
    throw error;
  }
}
module.exports = updateWithdrawStatus;
