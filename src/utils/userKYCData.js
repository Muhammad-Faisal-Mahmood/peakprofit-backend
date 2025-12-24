const User = require("../user/user.model");

const userKYCData = async (userId) => {
  const user = await User.findById(userId)
    .populate({
      path: "kycId",
      select:
        "status dateOfBirth rejectionReason socials idFrontImage idBackImage createdAt updatedAt legalName",
    })
    .populate({
      path: "kycHistory",
      select:
        "status dateOfBirth rejectionReason socials idFrontImage idBackImage createdAt updatedAt legalName",
      options: { sort: { createdAt: -1 } }, // Latest first
    })
    .select("kycId kycHistory");

  if (!user) {
    throw new Error(res, "User not found");
  }

  // Format current KYC if exists
  let currentKYC = null;
  if (user.kycId) {
    currentKYC = {
      _id: user.kycId._id,
      status: user.kycId.status,
      dateOfBirth: user.kycId.dateOfBirth,
      socials: user.kycId.socials,
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

  return {
    currentKYC: currentKYC,
    kycHistory: kycHistory,
    submissionStats: {
      totalSubmissions: totalSubmissions,
      submissionsLeft: submissionsLeft,
      canResubmit: canResubmit,
    },
  };
};

module.exports = userKYCData;
