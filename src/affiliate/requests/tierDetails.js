const { TIER_CONFIG } = require("../affiliate.service");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const Affiliate = require("../affiliate.model");

const tierDetails = async (req, res) => {
  try {
    const affiliateId = req.user.affiliateId;
    if (!affiliateId) {
      return sendErrorResponse(res, "Affiliate profile not found");
    }

    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return sendErrorResponse(res, "Affiliate profile not found");
    }

    // Create a copy of the TIER_CONFIG to avoid modifying the original
    const tierDetails = { ...TIER_CONFIG };

    if (affiliate.tier === "PLATINUM") {
      // For Platinum tier, update the commission percentage with the affiliate's actual commission
      tierDetails.PLATINUM = {
        ...tierDetails.PLATINUM,
        commissionPercentage: affiliate.commissionPercentage,
      };
    }

    return sendSuccessResponse(res, tierDetails);
  } catch (error) {
    console.error("Error in requestTierDetails:", error);
    return sendErrorResponse(res, "Internal server error", 500);
  }
};

module.exports = { tierDetails };
