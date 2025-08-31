const User = require("../../user/user.model");
const Affiliate = require("../../affiliate/affiliate.model");
const { Withdraw } = require("../../withdraw/withdraw.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const requestWithdraw = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, paymentMethod, challengeId = null, notes = "" } = req.body;

    // Validate required fields
    if (!amount || !paymentMethod) {
      return sendErrorResponse(res, "Amount and payment method are required");
    }

    // Validate amount
    if (amount <= 0) {
      return sendErrorResponse(res, "Amount must be greater than 0");
    }

    // Validate payment method structure
    if (!paymentMethod.type) {
      return sendErrorResponse(res, "Payment method type is required");
    }

    const validPaymentTypes = [
      "BANK_ACCOUNT",
      "PAYPAL",
      "STRIPE",
      "CRYPTO",
      "OTHER",
    ];
    if (!validPaymentTypes.includes(paymentMethod.type)) {
      return sendErrorResponse(res, "Invalid payment method type");
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return sendErrorResponse(res, "User not found");
    }

    // Find affiliate profile
    const affiliate = await Affiliate.findOne({ userId: userId });
    if (!affiliate) {
      return sendErrorResponse(res, "Affiliate profile not found");
    }

    // Check if user has sufficient balance
    if (!affiliate.canWithdraw(amount)) {
      return sendErrorResponse(
        res,
        `Insufficient balance. Available balance: $${affiliate.balance}`
      );
    }

    // Validate challenge if provided
    if (challengeId) {
      const Challenge = require("../../challenge/challenge.model");
      const challenge = await Challenge.findById(challengeId);
      if (!challenge) {
        return sendErrorResponse(res, "Invalid challenge ID");
      }
    }

    // Create withdrawal request
    const withdrawData = {
      userId: userId,
      amount: amount,
      paymentMethod: paymentMethod,
      challengeId: challengeId,
      notes: notes.trim(),
      status: "REQUESTED",
      requestedDate: new Date(),
    };

    // Only add affiliateId for affiliate withdrawals
    if (!challengeId && affiliate) {
      withdrawData.affiliateId = affiliate._id;
    }

    const newWithdraw = new Withdraw(withdrawData);

    // Save withdrawal request
    await newWithdraw.save();

    let responseData = {};

    if (challengeId) {
      // Challenge withdrawal - no affiliate operations needed
      const populatedWithdraw = await Withdraw.findById(newWithdraw._id)
        .populate("userId", "name email")
        .populate("challengeId", "name cost");

      responseData = {
        withdraw: populatedWithdraw,
        type: "challenge",
      };
    } else {
      // Affiliate withdrawal - add reference to affiliate and include affiliate details
      affiliate.withdraws.push(newWithdraw._id);
      await affiliate.save();

      const populatedWithdraw = await Withdraw.findById(newWithdraw._id)
        .populate("userId", "name email")
        .populate("affiliateId", "referralCode tier");

      responseData = {
        withdraw: populatedWithdraw,
        availableBalance: affiliate.balance,
        affiliateInfo: {
          referralCode: affiliate.referralCode,
          tier: affiliate.tier,
          totalEarnings: affiliate.totalEarnings,
          totalWithdrawn: affiliate.totalWithdrawn,
        },
        type: "affiliate",
      };
    }

    return sendSuccessResponse(
      res,
      "Withdrawal request submitted successfully",
      responseData
    );
  } catch (error) {
    console.error("Error registering withdrawal:", error);

    // Handle specific validation errors
    if (error.name === "ValidationError") {
      const errorMessages = Object.values(error.errors).map(
        (err) => err.message
      );
      return sendErrorResponse(
        res,
        `Validation error: ${errorMessages.join(", ")}`
      );
    }

    return sendErrorResponse(res, "Error processing withdrawal request");
  }
};

module.exports = requestWithdraw;
