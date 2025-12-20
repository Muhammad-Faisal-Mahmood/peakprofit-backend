const User = require("../user.model"); // Adjust the path based on your project structure
const { getAffiliateStatusByUserId } = require("../../shared/GeneralHelper");
const mongoose = require("mongoose");

const getUser = async (req, res) => {
  try {
    const { email } = req.user; // Extract email from req.user
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    // Query the database for the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const affiliateStatus = await getAffiliateStatusByUserId(user._id);
    let kycInfo = null;
    if (user?.kycId) {
      const kyc = await mongoose
        .model("KYC")
        .findById(user.kycId)
        .select("_id status rejectionReason");
      if (kyc) {
        console.log(kyc);
        kycInfo = {
          id: kyc._id,
          status: kyc.status,
        };

        if (kyc.status === "rejected") {
          kycInfo.rejectionReason = kyc.rejectionReason || "No reason provided";
        }
      }
    }
    const userData = {
      id: user._id,
      email: user.email,
      name: user.name,
      profilePicture: user.profilePicture,
      role: user.role,
      affiliateId: user?.affiliateId,
      referredBy: user?.referredBy,
      affiliateStatus: affiliateStatus,
      kyc: kycInfo,
      kycApplicationsCount: user?.kycHistory ? user.kycHistory.length : 0,
      status: user.status,
    };

    res.json(userData);
  } catch (error) {
    console.error("Error fetching user:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching user data." });
  }
};

module.exports = getUser;
