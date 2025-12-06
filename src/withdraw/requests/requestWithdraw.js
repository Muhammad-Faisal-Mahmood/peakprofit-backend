const User = require("../../user/user.model");
const Affiliate = require("../../affiliate/affiliate.model");
const Account = require("../../trade/account/account.model");
const KYC = require("../../kyc/kyc.model");
const { Withdraw } = require("../../withdraw/withdraw.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const requestWithdraw = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, paymentMethod, accountId = null, notes = "" } = req.body;

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
    const user = await User.findById(userId).populate("kycId");
    if (!user) {
      return sendErrorResponse(res, "User not found");
    }

    // **KYC Verification Check**
    if (!user.kycId) {
      return sendErrorResponse(
        res,
        "KYC verification required. Please complete KYC verification to request withdrawals"
      );
    }

    if (user.kycId.status !== "approved") {
      return sendErrorResponse(
        res,
        `KYC verification is ${user.kycId.status}. Only approved KYC allows withdrawals`
      );
    }

    let withdrawData;
    let responseData = {};

    // **ACCOUNT WITHDRAWAL (Trading Account Payout)**
    if (accountId) {
      // Find the trading account
      const account = await Account.findById(accountId);
      if (!account) {
        return sendErrorResponse(res, "Account not found");
      }

      // Verify account belongs to the user
      if (account.userId.toString() !== userId) {
        return sendErrorResponse(
          res,
          "You do not have permission to withdraw from this account"
        );
      }

      // Check account eligibility for payout
      const eligibility = account.canRequestPayout();
      if (!eligibility.eligible) {
        return sendErrorResponse(
          res,
          `Account payout not eligible: ${eligibility.errors.join("; ")}`
        );
      }

      // Get available payout amount (85% of profit)
      const availablePayoutAmount = account.getAvailablePayoutAmount();

      if (amount > availablePayoutAmount) {
        return sendErrorResponse(
          res,
          `Requested amount ($${amount.toFixed(
            2
          )}) exceeds available payout amount ($${availablePayoutAmount.toFixed(
            2
          )}). You can withdraw up to 85% of your profit`
        );
      }

      // Create withdrawal data
      withdrawData = {
        userId: userId,
        withdrawType: "ACCOUNT",
        amount: amount,
        paymentMethod: paymentMethod,
        accountId: account._id,
        notes: notes.trim(),
        requestedDate: new Date(),
      };

      const newWithdraw = new Withdraw(withdrawData);

      try {
        // Process the payout through account
        await account.processPayout(newWithdraw._id, newWithdraw.amount);
      } catch (error) {
        return sendErrorResponse(res, error.message);
      }

      // Save withdrawal request
      await newWithdraw.save();

      // Populate and prepare response
      const populatedWithdraw = await Withdraw.findById(newWithdraw._id)
        .populate("userId", "name email")
        .populate("accountId");

      responseData = {
        withdraw: populatedWithdraw,
        type: "account",
      };
    }
    // **AFFILIATE WITHDRAWAL**
    else {
      // Find affiliate profile
      const affiliate = await Affiliate.findOne({ userId: userId });
      if (!affiliate) {
        return sendErrorResponse(res, "Affiliate profile not found");
      }

      // Check if user has sufficient balance
      if (!affiliate.canWithdraw(amount)) {
        return sendErrorResponse(
          res,
          `Insufficient balance. Available balance: $${affiliate.balance.toFixed(
            2
          )}`
        );
      }

      // Create withdrawal data
      withdrawData = {
        userId: userId,
        withdrawType: "AFFILIATE",
        amount: amount,
        paymentMethod: paymentMethod,
        affiliateId: affiliate._id,
        notes: notes.trim(),
        requestedDate: new Date(),
      };

      const newWithdraw = new Withdraw(withdrawData);

      try {
        // Process the withdrawal through affiliate
        await affiliate.processWithdraw(
          newWithdraw._id,
          newWithdraw.amount,
          newWithdraw.status
        );
      } catch (error) {
        return sendErrorResponse(res, error.message);
      }

      // Save withdrawal request
      await newWithdraw.save();

      // Populate and prepare response
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
    console.error("Error processing withdrawal:", error);

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
