const User = require("../../user/user.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const userKYCData = require("../../utils/userKYCData");

const getUserKYCHistory = async (req, res) => {
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

    const kycData = await userKYCData(userId);
    return sendSuccessResponse(
      res,
      "KYC history fetched successfully.",
      kycData
    );
  } catch (error) {
    console.log("Error fetching KYC history:", error.message);
    return sendErrorResponse(res, "Could not fetch KYC history.");
  }
};

module.exports = getUserKYCHistory;
