const KYC = require("../../kyc/kyc.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const reviewKYCApplication = async (req, res) => {
  const VALID_STATUSES = ["approved", "rejected"];

  try {
    // Ensure user is admin
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized - Admin access required");
    }

    const { kycId } = req.params;
    const { status, rejectionReason } = req.body;

    // Validate required fields
    if (!status) {
      return sendErrorResponse(res, "Status is required");
    }

    if (!VALID_STATUSES.includes(status.toLowerCase())) {
      return sendErrorResponse(
        res,
        "Invalid status. Allowed values are: approved, rejected"
      );
    }

    // Find the KYC application
    const kycApplication = await KYC.findById(kycId).populate(
      "user",
      "name email"
    );

    if (!kycApplication) {
      return sendErrorResponse(res, "KYC application not found");
    }

    // Check if application is still pending
    if (kycApplication.status !== "pending") {
      return sendErrorResponse(
        res,
        `Cannot review application. Current status: ${kycApplication.status}`
      );
    }

    // Update KYC application
    const updateData = {
      status,
    };

    if (status === "rejected") {
      updateData.rejectionReason = rejectionReason;
    } else {
      updateData.rejectionReason = null; // Clear any previous rejection reason
    }

    const updatedKYC = await KYC.findByIdAndUpdate(kycId, updateData, {
      new: true,
    }).populate([{ path: "user", select: "name email" }]);

    return sendSuccessResponse(res, `KYC application ${status} successfully`, {
      kycId: updatedKYC._id,
      user: updatedKYC.user,
      status: updatedKYC.status,
      rejectionReason: updatedKYC.rejectionReason,
    });
  } catch (error) {
    console.error("Error reviewing KYC application:", error);
    return sendErrorResponse(res, "Error reviewing KYC application");
  }
};

module.exports = reviewKYCApplication;
