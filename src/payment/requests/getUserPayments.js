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
    const payments = await Payment.find({ userId })
      .populate("userId", "name email") // Populate user details
      .populate("challengeId", "name accountSize cost") // Populate challenge details
      .sort({ createdAt: -1 }) // Most recent first
      .lean();

    // Transform the data to rename fields
    const transformedPayments = payments.map((payment) => {
      const { userId, challengeId, ...rest } = payment;
      return {
        ...rest,
        user: userId, // Rename userId to user
        challenge: challengeId, // Rename challengeId to challenge
        amountInDollars: (payment.total / 100).toFixed(2), // Convert cents to dollars
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
