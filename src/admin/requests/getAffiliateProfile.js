const Affiliate = require("../../affiliate/affiliate.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const { Withdraw } = require("../../withdraw/withdraw.model");

const getAffiliateProfile = async (req, res) => {
  try {
    if (!req.user || req.user.role != "Admin") {
      return sendErrorResponse(res, "Unauthorized");
    }

    const { affiliateId } = req.params;

    if (!affiliateId) {
      return sendErrorResponse(res, "Affiliate Id is required.");
    }

    const affiliateDoc = await Affiliate.findById(affiliateId)
      .populate("userId", "name email profilePicture")
      .populate("referrals.referredUser", "name email") // who was referred
      .populate("referrals.purchases.challenge", "title price") // challenge details
      .populate({
        path: "withdraws",
        model: Withdraw,
      });

    if (!affiliateDoc) {
      return sendErrorResponse(res, "Affiliate not found.");
    }

    const affiliate = affiliateDoc.toObject();
    affiliate.user = affiliate.userId;
    delete affiliate.userId;

    return sendSuccessResponse(
      res,
      "Affiliate profile found successfully",
      affiliate
    );
  } catch (error) {
    console.log("error message", error);
    return sendErrorResponse(res, "Couldn't find affiliate profile");
  }
};
module.exports = getAffiliateProfile;
