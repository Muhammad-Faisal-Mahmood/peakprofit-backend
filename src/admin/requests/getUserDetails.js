const User = require("../../user/user.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const Affiliate = require("../../affiliate/affiliate.model");
const KYC = require("../../kyc/kyc.model");
const Account = require("../../trade/account/account.model");

const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.role !== "Admin") {
      return sendErrorResponse(
        res,
        "Access denied. Admin privileges required."
      );
    }
    if (!userId) {
      return sendErrorResponse(res, "User ID is required.");
    }
    const user = await User.findById(userId);
    if (!user) {
      return sendErrorResponse(res, "User not found.");
    }

    let result = {
      _id: user._id,
      email: user.email,
      profilePicture: user.profilePicture || "",
      name: user.name,
      status: user.status,
      joinedAt: user.createdAt,
      isVerified: user.isVerified,
    };

    if (user?.affiliateId) {
      const affiliateProfile = await Affiliate.findOne({ userId: user._id });
      if (affiliateProfile) {
        result.affiliateProfile = affiliateProfile;
      }
    } else {
      result.affiliateProfile = null;
    }

    if (user?.referredBy) {
      const referredBy = await User.findById(user.referredBy);
      if (referredBy) {
        result.referredBy = referredBy;
      }
    } else {
      result.referredBy = null;
    }

    if (user?.kycId) {
      const kycDetails = await KYC.findById(user.kycId);
      if (kycDetails) {
        result.kycDetails = kycDetails;
      }
    } else {
      result.kycDetails = null;
    }

    if (user.accounts.length > 0) {
      const accounts = await Account.find({
        _id: { $in: user.accounts },
      }).populate({
        path: "payoutHistory",
        model: "Withdraw",
        options: { sort: { requestedDate: -1 } }, // Sort by most recent
      });
      result.accounts = accounts;
    } else result.accounts = [];
    return sendSuccessResponse(
      res,
      "User details fetched successfully.",
      result
    );
  } catch (error) {
    return sendErrorResponse(
      res,
      "An error occurred while fetching user details."
    );
  }
};

module.exports = getUserDetails;
