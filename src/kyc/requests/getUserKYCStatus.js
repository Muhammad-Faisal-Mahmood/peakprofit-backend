const User = require("../../user/user.model");
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

    // Find user with KYC history populated
    const user = await User.findById(req.user.userId)
      .populate({
        path: "kycId",
        select:
          "status dateOfBirth rejectionReason idFrontImage idBackImage createdAt updatedAt legalName",
      })
      .populate({
        path: "kycHistory",
        select:
          "status dateOfBirth rejectionReason idFrontImage idBackImage createdAt updatedAt legalName",
        options: { sort: { createdAt: -1 } }, // Latest first
      })
      .select("kycId kycHistory");

    if (!user) {
      return sendErrorResponse(res, "User not found");
    }

    // Format current KYC if exists
    let currentKYC = null;
    if (user.kycId) {
      currentKYC = {
        _id: user.kycId._id,
        status: user.kycId.status,
        dateOfBirth: user.kycId.dateOfBirth,
        rejectionReason: user.kycId.rejectionReason,
        legalName: user.kycId.legalName,
        idFrontImageUrl: `${process.env.BACKEND_URL}/uploads/kyc/${user.kycId.idFrontImage}`,
        idBackImageUrl: `${process.env.BACKEND_URL}/uploads/kyc/${user.kycId.idBackImage}`,
        createdAt: user.kycId.createdAt,
        updatedAt: user.kycId.updatedAt,
      };
    }

    // Format KYC history
    const kycHistory = user.kycHistory
      ? user.kycHistory.map((kyc) => ({
          _id: kyc._id,
          status: kyc.status,
          dateOfBirth: kyc.dateOfBirth,
          legalName: kyc.legalName,
          socials: kyc.socials,
          rejectionReason: kyc.rejectionReason,
          idFrontImageUrl: `${process.env.BACKEND_URL}/uploads/kyc/${kyc.idFrontImage}`,
          idBackImageUrl: `${process.env.BACKEND_URL}/uploads/kyc/${kyc.idBackImage}`,
          createdAt: kyc.createdAt,
          updatedAt: kyc.updatedAt,
        }))
      : [];

    // Calculate submission stats
    const totalSubmissions = user.kycHistory ? user.kycHistory.length : 0;
    const submissionsLeft = Math.max(0, 5 - totalSubmissions);
    const canResubmit =
      (!user.kycId || (user.kycId && user.kycId.status === "rejected")) &&
      submissionsLeft > 0;

    return sendSuccessResponse(res, "KYC status retrieved successfully", {
      currentKYC: currentKYC,
      kycHistory: kycHistory,
      submissionStats: {
        totalSubmissions: totalSubmissions,
        submissionsLeft: submissionsLeft,
        canResubmit: canResubmit,
      },
    });
  } catch (error) {
    console.error("Error fetching user KYC status:", error);
    return sendErrorResponse(res, "Error retrieving KYC status");
  }
};

module.exports = getUserKYCStatus;
