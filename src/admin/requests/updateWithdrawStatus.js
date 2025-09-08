const { Withdraw } = require("../../withdraw/withdraw.model");
const Affiliate = require("../../affiliate/affiliate.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

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

    // Validate transactionRef for PAID status
    if (uppercaseStatus === "PAID" && !transactionRef) {
      return sendErrorResponse(
        res,
        "Transaction reference is required for PAID status"
      );
    }

    // Update withdraw status and additional fields
    withdraw.status = uppercaseStatus;
    withdraw.processedDate = new Date();

    if (transactionRef) {
      withdraw.transactionRef = transactionRef;
    }

    if (req.body.notes) {
      withdraw.notes = req.body.notes;
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
        path: "challengeId",
        select: "name cost",
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
      challenge: updatedWithdraw.challengeId
        ? {
            id: updatedWithdraw.challengeId._id,
            name: updatedWithdraw.challengeId.name,
            cost: updatedWithdraw.challengeId.cost,
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

module.exports = updateWithdrawStatus;
