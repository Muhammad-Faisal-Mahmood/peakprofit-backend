const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const Payment = require("../payment.model");

const getUserPaymentById = async (req, res) => {
  try {
    // Check authentication
    if (!req.user || !req.user.userId) {
      return sendErrorResponse(res, "Authentication required");
    }

    const { paymentId } = req.params;

    const userId = req.user.userId;

    // Fetch all payments for the user
    const payment = await Payment.findById(paymentId)
      .populate("userId", "name email") // Populate user details
      .populate("challengeId", "name accountSize cost") // Populate challenge details
      .populate("accountId", "initialBalance balance equity accountType")
      .lean();

    if (!payment) {
      return sendErrorResponse(res, "Couldn't find the payment");
    }

    // const payment = paymentDoc.toObject();
    payment.user = payment.userId;
    payment.challenge = payment.challengeId;
    payment.account = payment.accountId;
    delete payment.challengeId;
    delete payment.userId;
    delete payment.accountId;

    return sendSuccessResponse(res, "Payment retrieved successfully", payment);
  } catch (error) {
    console.error("Error fetching payment:", error);
    return sendErrorResponse(res, "Couldn't fetch payment");
  }
};

module.exports = getUserPaymentById;
