const User = require("../../user/user.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const userKYCData = require("../../utils/userKYCData");

const getUserKYCStatus = async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.userId) {
      return sendErrorResponse(res, "Authentication required");
    }

    const kycData = await userKYCData(req.user.userId);

    return sendSuccessResponse(
      res,
      "KYC status retrieved successfully",
      kycData
    );
  } catch (error) {
    console.error("Error fetching user KYC status:", error);
    return sendErrorResponse(res, "Error retrieving KYC status");
  }
};

module.exports = getUserKYCStatus;
