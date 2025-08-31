const Affiliate = require("./affiliate.model"); // Adjust path as needed
const User = require("../user/user.model"); // Adjust path as needed

async function findByReferralCode(referralCode) {
  return await Affiliate.findOne({ referralCode });
}

async function processReferralSignup(referralCode, newUserId) {
  if (!referralCode) return null;

  try {
    const affiliate = await findByReferralCode(referralCode);
    if (!affiliate) {
      console.log(`Invalid referral code: ${referralCode}`);
      return null;
    }

    // Add referral record to affiliate
    await affiliate.addReferral(newUserId);

    return affiliate.userId; // Return the affiliate user ID
  } catch (error) {
    console.error("Error processing referral signup:", error);
    return null;
  }
}

async function processPurchase(userId, challengeId, challengeCost) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.referredBy) {
      return; // User wasn't referred by anyone
    }

    const affiliate = await Affiliate.findOne({ userId: user.referredBy });
    if (!affiliate) {
      console.log("Affiliate not found for referred user");
      return;
    }

    await affiliate.addPurchase(userId, challengeId, challengeCost);
    console.log(`Commission processed for affiliate ${affiliate.userId}`);
  } catch (error) {
    console.error("Error processing purchase commission:", error);
  }
}

module.exports = {
  findByReferralCode,
  processReferralSignup,
  processPurchase,
};
