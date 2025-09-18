const KYC = require("../kyc.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const getUserKYCStatus = async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.userId) {
      return sendErrorResponse(res, "Authentication required");
    }

    // Find user's KYC application
    const kycApplication = await KYC.findOne({ user: req.user.userId })
      .populate("user", "name email")
      .select("-socials"); // Don't return SSN for security

    if (!kycApplication) {
      return sendSuccessResponse(res, "No KYC application found", {
        hasKYC: false,
        status: null,
      });
    }

    return sendSuccessResponse(res, "KYC status retrieved successfully", {
      hasKYC: true,
      kyc: {
        _id: kycApplication._id,
        status: kycApplication.status,
        dateOfBirth: kycApplication.dateOfBirth,
        rejectionReason: kycApplication.rejectionReason,

        createdAt: kycApplication.createdAt,
        updatedAt: kycApplication.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching user KYC status:", error);
    return sendErrorResponse(res, "Error retrieving KYC status");
  }
};

module.exports = getUserKYCStatus;
