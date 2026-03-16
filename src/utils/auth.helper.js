const affiliateService = require("../affiliate/affiliate.service");
const logoPath = require("../constants/logoPath");
const { sendEmail } = require("../shared/mail.service");
async function handleReferral(user, refcode) {
  if (!refcode) return null;
  console.log("user in handle referral:", user);
  console.log("ref code in handle referral:", refcode);

  try {
    const referralResult = await affiliateService.processReferralSignup(
      refcode,
      user._id,
    );

    if (referralResult) {
      user.referredBy = referralResult.affiliateUserId;
      user.referralCode = refcode;
      await user.save();

      console.log(
        `User ${user._id} referred by ${referralResult.affiliateUserId} using code ${refcode}`,
      );
    }

    return referralResult;
  } catch (error) {
    console.error("Referral processing failed:", error);
    return null;
  }
}

async function notifyAdminSignup(user, referralResult, templatePath) {
  const replacements = {
    email: user.email,
    createdAt: user.createdAt,
    username: user.name,
    userId: user._id,
    referrer: referralResult?.affiliateName || "-",
    referralCode: user?.referralCode || "-",
    LOGO_URL: logoPath,
  };

  const template = templatePath;

  await sendEmail(
    "New Sign Up",
    template,
    process.env.ADMIN_EMAIL,
    replacements,
  );
}

module.exports = {
  handleReferral,
  notifyAdminSignup,
};
