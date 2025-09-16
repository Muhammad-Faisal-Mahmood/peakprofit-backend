const mongoose = require("mongoose");
const Affiliate = require("../../affiliate/affiliate.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

// Function to update affiliate commission percentage
const updateAffiliateCommission = async (req, res) => {
  // Check if user is admin
  if (req.user.role !== "Admin") {
    return sendErrorResponse(res, "Unauthorized - Admin access required");
  }

  try {
    const { affiliateId } = req.params;
    const { commissionPercentage } = req.body;

    // Validate commission percentage
    if (commissionPercentage === undefined || commissionPercentage === null) {
      return sendErrorResponse(res, "Commission percentage is required");
    }

    if (
      typeof commissionPercentage !== "number" ||
      commissionPercentage < 0 ||
      commissionPercentage > 100
    ) {
      return sendErrorResponse(
        res,
        "Commission percentage must be a number between 0 and 100"
      );
    }

    // Find the affiliate
    const affiliate = await Affiliate.findById(affiliateId).populate(
      "userId",
      "name email"
    );
    if (!affiliate) {
      return sendErrorResponse(res, "Affiliate not found");
    }

    // Check if affiliate tier is PLATINUM
    if (affiliate.tier !== "PLATINUM") {
      return sendErrorResponse(
        res,
        "Commission percentage can only be updated for PLATINUM tier affiliates"
      );
    }

    // Store old commission percentage for response
    const oldCommissionPercentage = affiliate.commissionPercentage;

    // Update commission percentage
    affiliate.commissionPercentage = commissionPercentage;
    await affiliate.save();

    const responseData = {
      affiliate: {
        id: affiliate._id,
        userId: affiliate.userId._id,
        userName: affiliate.userId.name,
        userEmail: affiliate.userId.email,
        tier: affiliate.tier,
        referralCode: affiliate.referralCode,
        oldCommissionPercentage: oldCommissionPercentage,
        newCommissionPercentage: affiliate.commissionPercentage,
        updatedAt: affiliate.updatedAt,
      },
    };

    return sendSuccessResponse(
      res,
      `Commission percentage updated successfully from ${oldCommissionPercentage}% to ${commissionPercentage}%`,
      responseData
    );
  } catch (error) {
    console.error("Error updating affiliate commission:", error);
    return sendErrorResponse(res, "Internal server error: " + error.message);
  }
};

module.exports = updateAffiliateCommission;
