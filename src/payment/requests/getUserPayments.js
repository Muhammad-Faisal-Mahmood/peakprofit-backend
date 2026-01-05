const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const Payment = require("../payment.model");

const getUserPayments = async (req, res) => {
  try {
    // Check authentication
    if (!req.user || !req.user.userId) {
      return sendErrorResponse(res, "Authentication required");
    }

    const userId = req.user.userId;

    // Fetch all payments for the user
    const payments = await Payment.find({ userId, status: "accepted" })
      .populate("userId", "name email") // Populate user details
      .populate("challengeId", "name accountSize cost") // Populate challenge details
      .populate("accountId", "initialBalance balance equity accountType")
      .sort({ createdAt: -1 }) // Most recent first
      .lean();

    if (!payments) {
      return sendErrorResponse(res, "couldn't fetch user payments");
    }

    // Transform the data to rename fields
    const transformedPayments = payments.map((payment) => {
      const { userId, challengeId, accountId, ...rest } = payment;
      return {
        ...rest,
        user: userId, // Rename userId to user
        challenge: challengeId, // Rename challengeId to challenge
        account: accountId,
      };
    });

    return sendSuccessResponse(res, "Payments retrieved successfully", {
      payments: transformedPayments,
    });
  } catch (error) {
    console.error("Error fetching user payments:", error);
    return sendErrorResponse(res, error.message);
  }
};

module.exports = getUserPayments;
