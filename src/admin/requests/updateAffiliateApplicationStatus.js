const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const AffiliateApplication = require("../../affiliate/affiliateApplication.model");
const User = require("../../user/user.model");
const Affiliate = require("../../affiliate/affiliate.model");
const { sendEmail } = require("../../shared/mail.service");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

// Function to generate secure password
const generateSecurePassword = (length = 12) => {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  const allChars = lowercase + uppercase + numbers + specialChars;
  let password = "";

  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)];

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

// Function to generate unique referral code based on username
const generateUniqueReferralCode = async (name) => {
  // Clean the name and make it uppercase
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const baseName = cleanName.substring(0, 8); // Take first 8 characters

  let referralCode = baseName;
  let counter = 1;

  // Keep checking if referral code exists and increment counter if needed
  while (true) {
    const existingAffiliate = await Affiliate.findOne({
      referralCode: referralCode,
    });

    if (!existingAffiliate) {
      // Referral code is unique, we can use it
      break;
    }

    // If referral code exists, append counter
    counter++;
    referralCode = `${baseName}-${counter}`;
  }

  return referralCode;
};

// Main controller function to handle affiliate application status update
const updateAffiliateApplicationStatus = async (req, res) => {
  if (req.user.role !== "Admin") {
    return sendErrorResponse(res, "Unauthorized - Admin access required");
  }
  try {
    const { applicationId } = req.params;
    const { status, isPlatinumTier = false, commissionPercentage } = req.body;

    // Validate status
    if (!["accepted", "rejected"].includes(status)) {
      return sendErrorResponse(
        res,
        "Status must be either 'accepted' or 'rejected'"
      );
    }

    // Validate commission percentage for secret tier
    if (
      isPlatinumTier &&
      (commissionPercentage === undefined || commissionPercentage === null)
    ) {
      return sendErrorResponse(
        res,
        "Commission percentage is required when setting affiliate to platinum tier"
      );
    }

    // Validate commission percentage range
    if (commissionPercentage !== undefined && commissionPercentage !== null) {
      if (
        typeof commissionPercentage !== "number" ||
        commissionPercentage < 0 ||
        commissionPercentage > 100
      ) {
        return sendErrorResponse(
          res,
          "Commission percentage must be a number between 0 and 100"
        );
      }
    }

    // Validate status
    if (!["accepted", "rejected"].includes(status)) {
      return sendErrorResponse(
        res,
        "Status must be either 'accepted' or 'rejected'"
      );
    }

    // Find the application
    const application = await AffiliateApplication.findById(applicationId);
    if (!application) {
      return sendErrorResponse(res, "Affiliate application not found");
    }

    if (application.status != "pending") {
      return sendErrorResponse(
        res,
        "Application does not have a pending status"
      );
    }

    // Update application status
    application.status = status;
    await application.save();

    if (status === "rejected") {
      return sendSuccessResponse(
        res,
        "Application rejected successfully",
        application
      );
    }

    // If accepted, handle user creation and affiliate setup
    let user;
    let passwordGenerated = false;
    let generatedPassword = "";

    if (!application.userId) {
      // Create new user
      generatedPassword = generateSecurePassword();
      const hashedPassword = await bcrypt.hash(generatedPassword, 12);
      passwordGenerated = true;

      user = new User({
        _id: new mongoose.Types.ObjectId(),
        email: application.email,
        name: application.name,
        password: hashedPassword,
        isVerified: true, // Auto-verify affiliate accounts
        role: "User",
      });

      await user.save();

      // Update application with new userId
      application.userId = user._id;
      await application.save();
    } else {
      // Get existing user
      user = await User.findById(application.userId);
      if (!user) {
        return sendErrorResponse(res, "User not found");
      }
    }

    // Generate unique referral code and link
    const referralCode = await generateUniqueReferralCode(application.name);
    const backendUrl = process.env.FRONT_APP_URL_DEV || "http://localhost:5173";
    const referralLink = `${backendUrl}/signup?refcode=${referralCode}`;

    // Determine tier
    const tier = isPlatinumTier ? "PLATINUM" : "BRONZE";

    const cPercentage = commissionPercentage ? commissionPercentage : 5;

    // Create affiliate profile
    const affiliate = new Affiliate({
      userId: user._id,
      tier: tier,
      referralCode: referralCode,
      referralLink: referralLink,
      referrals: [],
      earnings: 0,
      commissionPercentage: cPercentage,
    });

    await affiliate.save();

    // Update user with affiliate reference
    user.affiliateId = affiliate._id;
    await user.save();

    // Send email with password if user was created
    if (passwordGenerated) {
      try {
        const emailSubject =
          "Welcome to Our Affiliate Program - Your Account Details";
        const templatePath = "./src/affiliate/mails/affiliate-welcome.html"; // Adjust path as needed
        const replacements = {
          name: user.name,
          email: user.email,
          password: generatedPassword,
          referralCode: referralCode,
          referralLink: referralLink,
        };

        await sendEmail(emailSubject, templatePath, user.email, replacements);
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Don't fail the entire operation if email fails
      }
    }

    const responseData = {
      application,
      affiliate: {
        id: affiliate._id,
        tier: affiliate.tier,
        referralCode: affiliate.referralCode,
        referralLink: affiliate.referralLink,
      },
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
      passwordSent: passwordGenerated,
    };

    return sendSuccessResponse(
      res,
      "Application accepted successfully",
      responseData
    );
  } catch (error) {
    console.error("Error updating affiliate application:", error);
    return sendErrorResponse(res, "Internal server error: " + error.message);
  }
};

module.exports = updateAffiliateApplicationStatus;
