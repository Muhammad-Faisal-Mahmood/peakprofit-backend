const Affiliate = require("../affiliate.model"); // adjust path
const { Withdraw } = require("../../withdraw/withdraw.model"); // adjust path
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service"); // adjust path
const ResponseCode = require("../../shared/ResponseCode"); // adjust path

// Express handler to get affiliate profile
async function getAffiliateProfile(req, res) {
  const userId = req.user.userId;

  try {
    const affiliate = await Affiliate.findOne({ userId })
      .populate("userId", "name email") // basic user details
      .populate("referrals.referredUser", "name email") // who was referred
      .populate("referrals.purchases.challenge", "title price") // challenge details
      .populate({
        path: "withdraws",
        model: Withdraw,
      });

    if (!affiliate) {
      return res
        .status(ResponseCode.NOT_FOUND)
        .json({ message: "Affiliate profile not found" });
    }

    return sendSuccessResponse(
      res,
      "Affiliate profile fetched successfully",
      affiliate
    );
  } catch (error) {
    console.error("Error fetching affiliate profile:", error);
    return sendErrorResponse(res, "Error fetching affiliate profile");
  }
}

module.exports = { getAffiliateProfile };
