const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const CryptoJS = require("crypto-js");
const path = require("path");
// const Invitation = require("../project/invitation/invitation.model.js");
// const Project = require("../project/project.model.js");

//Strategy
require("./google.strategy");
require("./github.strategy");
const { getAffiliateStatusByUserId } = require("../shared/GeneralHelper.js");

// JWT
const jwt = require("../middleware/jwt.js");
const simplejwt = require("jsonwebtoken");

//Passport
const passport = require("passport");

//General Helper
const GeneralHelper = require("../shared/GeneralHelper.js");

// Middlewares
const checkCreateParams = require("./requests/create.js");
const checkPasswordParams = require("./requests/password.js");

// Mail
const { sendEmail } = require("../shared/mail.service.js");

// Models
const User = require("../user/user.model.js");
const TwoFactorAuth = require("./auth.model.js");

// Services
const UserService = require("../user/user.service.js");
const affiliateService = require("../affiliate/affiliate.service.js");

// Response Helpers
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../shared/response.service");

//SignUp
router.post("/sign-up", checkCreateParams, async (req, res, next) => {
  const { name, email, password, inviteToken, refcode } = req.body;

  try {
    let userModel = await UserService.findByEmail(email.toLowerCase());
    if (userModel != null) {
      return sendErrorResponse(res, "Email Already Exist!");
    }

    let user = await UserService.create(name, email, password);

    let referredByUserId = null;
    if (refcode) {
      try {
        referredByUserId = await affiliateService.processReferralSignup(
          refcode,
          user._id
        );
        if (referredByUserId) {
          // Update the user document with referral information
          user.referredBy = referredByUserId;
          user.referralCode = refcode;
          await user.save();
          console.log(
            `User ${user._id} referred by ${referredByUserId} using code ${refcode}`
          );
        }
      } catch (referralError) {
        console.error("Error processing referral:", referralError);
        // Don't fail signup if referral processing fails
      }
    }

    // Handle invitation if token exists
    let projectId = null;
    // if (inviteToken) {
    //   try {
    //     const invitation = await Invitation.findOne({ token: inviteToken });

    //     if (invitation && invitation.inviteeEmail === email.toLowerCase()) {
    //       const project = await Project.findById(invitation.project);

    //       if (!project.members.includes(user._id)) {
    //         project.members.push(user._id);
    //         await project.save();
    //         projectId = project._id;
    //       }

    //       invitation.status = "Accepted";
    //       await invitation.save();
    //     }
    //   } catch (inviteError) {
    //     console.error("Error processing invitation:", inviteError);
    //   }
    // }

    // Generate OTP and send verification
    const otp = GeneralHelper.getOtp();
    const authData = new TwoFactorAuth({
      userId: user._id,
      email: user.email,
      authCode: otp.code,
      status: false,
      expiration: otp.expiration,
    });

    await authData.save();

    sendVerificationLink(user, otp);

    return sendSuccessResponse(res, "Verification sent to your email", {
      userId: user._id,
      data: authData,
      // projectId: projectId,
      referredBy: referredByUserId,
    });
  } catch (error) {
    console.error("Error while signing up:", error);
    return sendErrorResponse(res, `Failed to signup: ${error.message}`);
  }
});

// Login
router.post("/login", async (req, res, next) => {
  let request = req.body;

  if (!request.email) return sendErrorResponse(res, "Missing Parameters!");

  let user = await UserService.findByEmail(request.email.toLowerCase());
  if (user == null) {
    user = await UserService.findByUsername(request.email);
    if (user == null) {
      return sendErrorResponse(res, "User Does not exist!");
    }
  }

  if (user.isVerified == false)
    return sendErrorResponse(res, "Please verify yourself first");

  let matched = await GeneralHelper.comparePassword(
    request.password,
    user.password
  );

  if (!matched) return sendErrorResponse(res, "Invalid Password!");

  let data = {
    email: user.email,
    userId: user._id,
    role: user?.role,
    name: user.name,
    affiliateId: user?.affiliateId,
  };
  const token = simplejwt.sign(data, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const affiliateStatus = await getAffiliateStatusByUserId(user._id);
  let result = {
    _id: user._id,
    email: user.email,
    profilePicture: user.profilePicture || "",
    role: user.role || null,
    token: token,
    name: user.name,
    affiliateId: user?.affiliateId,
    referredBy: user?.referredBy,
    affiliateStatus: affiliateStatus,
  };

  // await NotificationService.create("Login successfully!", user._id);
  return sendSuccessResponse(res, "Login Successful", result);
});

// Verify Code
router.get("/verify-account", async (req, res) => {
  try {
    const encryptedText = req.query.token.replace(/ /g, "+");
    const bytes = CryptoJS.AES.decrypt(encryptedText, process.env.JWT_SECRET);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    const [email, code] = decrypted.split("/");
    const authRecord = await TwoFactorAuth.findOne({
      email: email,
      authCode: code,
    });

    if (!authRecord) {
      return res.redirect(`${process.env.FRONT_APP_URL_DEV}`);
    }
    if (authRecord.authCode != code) {
      return res.redirect(`${process.env.FRONT_APP_URL_DEV}`);
    }
    if (new Date() > new Date(authRecord.expiration)) {
      return res.redirect(`${process.env.FRONT_APP_URL_DEV}`);
    }
    let user = await UserService.findByEmail(email);
    if (!user) {
      return res.redirect(`${process.env.FRONT_APP_URL_DEV}`);
    }

    // Generate JWT token
    const token = simplejwt.sign(
      { userId: authRecord.userId },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h",
      }
    );

    // Instead of setting to null, mark as verified
    authRecord.status = true; // Mark as verified
    authRecord.authCode = undefined; // Remove the code
    authRecord.expiration = undefined; // Remove the expiration
    await authRecord.save();

    const updateVerification = await UserService.update(
      { _id: user._id },
      {
        isVerified: true,
      }
    );
    return res.redirect(`${process.env.FRONT_APP_URL_DEV}`);
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return sendErrorResponse(res, "Internal server error");
  }
});

// resend Code
router.post("/resend-verification-link", async (req, res, next) => {
  const { email } = req.body;
  try {
    let userExist = await UserService.findByEmail(email);
    if (userExist == null) {
      return sendErrorResponse(res, "User Not Exist!");
    }

    if (userExist.isVerified) {
      return sendErrorResponse(res, "Already Verified");
    }
    const otp = GeneralHelper.getOtp();

    // Store OTP and expiration time in the AuthModel
    const authData = new TwoFactorAuth({
      _id: new mongoose.Types.ObjectId(),
      userId: userExist._id,
      email: email,
      authCode: otp.code,
      status: false, // Initial status
      expiration: otp.expiration,
    });
    await authData.save();
    ``;
    sendVerificationLink(userExist, otp);

    // Return success response with user data and JWT token
    return sendSuccessResponse(res, "Verification sent to your email");
  } catch (error) {
    console.error("Error while signing up :", error);
    return sendErrorResponse(res, `Failed to signup: ${error.message}`);
  }
});

// Forgot Password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user with the provided email exists
    const user = await User.findOne({ email });
    if (!user) return sendErrorResponse(res, "User Not Found!");

    // Generate password reset token
    const resetToken = GeneralHelper.getOtp();

    // Set token expiration time (e.g., 1 hour)
    // const tokenExpiration = Date.now() + 3600000; // 1 hour

    sendForgotLink(user, resetToken.code);
    user.resetToken = resetToken.code;
    user.resetTokenExpiration = resetToken.expiration;
    await user.save();

    return sendSuccessResponse(
      res,
      "Password reset instructions sent to your email!"
    );
  } catch (error) {
    return sendErrorResponse(res, "Internal server error");
  }
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    const encryptedText = req.query.token.replace(/ /g, "+");
    const bytes = CryptoJS.AES.decrypt(encryptedText, process.env.JWT_SECRET);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    const [email, code] = decrypted.split("/");

    let mail = email?.trim()?.toLowerCase();

    const user = await User.findOne({ email: mail });

    if (!user) return sendErrorResponse(res, "User not found!");

    // Check if reset code matches
    if (user.resetToken !== Number(code))
      return sendErrorResponse(res, "Invalid Link");

    // Check if password and confirm password match
    if (newPassword !== confirmPassword)
      return sendErrorResponse(res, "Confirm Password does not match");

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    user.password = hashedPassword;

    // Clear reset token and code
    user.resetToken = null;
    user.resetCode = null;

    // Save the updated user
    await user.save();
    return sendSuccessResponse(res, "Password reset successfully");
  } catch (error) {
    return sendErrorResponse(res, "Internal server error");
  }
});

// Change Password
router.post("/change-password", jwt, checkPasswordParams, async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    // Check if all required fields are provided
    if (!oldPassword || !newPassword || !confirmNewPassword)
      return sendErrorResponse(res, "Missing required fields!");

    // Check if new password matches confirm new password
    if (newPassword !== confirmNewPassword)
      return sendErrorResponse(res, "Confirm password does not match!");

    const user = await User.findById(req.user.userId);

    // Check if user exists
    if (!user) return sendErrorResponse(res, "User not found!");

    // Check if old password matches the current password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid)
      return sendErrorResponse(res, "Invalid old password!");

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password with the new hashed password
    user.password = hashedNewPassword;
    await user.save();
    // await NotificationService.create(
    //   "Your password is changed successfully!",
    //   user._id
    // );
    return sendSuccessResponse(res, "Password changed successfully");
  } catch (error) {
    return sendErrorResponse(res, "Internal server error");
  }
});

async function sendVerificationLink(user, otp) {
  const encrypted = CryptoJS.AES.encrypt(
    `${user.email}/${otp.code}`,
    process.env.JWT_SECRET
  ).toString();

  const link = `${process.env.BACKEND_URL}/api/auth/verify-account?token=${encrypted}`;
  const replacements = {
    expiration: otp.expiration,
    name: user.name,
    link: link,
  };
  const template = path.join(__dirname, "mails", "verification.html");
  sendEmail("Verification Link", template, user.email, replacements);
}

async function sendForgotLink(user, resetToken) {
  const encrypted = CryptoJS.AES.encrypt(
    `${user.email}/${resetToken}`,
    process.env.JWT_SECRET
  ).toString();

  const link = `${process.env.FRONT_APP_URL_DEV}/reset-password?token=${encrypted}`;
  const replacements = {
    reset_link: link,
    name: user.name,
  };
  const template = path.join(__dirname, "mails", "forgot.html");
  sendEmail("Reset Your Password", template, user.email, replacements);
}

// router.get("/google", (req, res, next) => {
//   const inviteToken = req.query.invite;
//   passport.authenticate("google", {
//     scope: ["profile", "email"],
//     state: inviteToken ? `invite=${inviteToken}` : undefined,
//   })(req, res, next);
// });

// // Google callback
// router.get(
//   "/google/callback",
//   passport.authenticate("google", {
//     failureRedirect: `${process.env.FRONT_APP_URL_DEV}`,
//   }),
//   async (req, res) => {
//     try {
//       const user = req.user;
//       const inviteToken =
//         req.query.invite ||
//         (req.query.state && req.query.state.includes("invite=")
//           ? req.query.state.split("invite=")[1]
//           : null); // Handle token from query or state

//       if (user) {
//         // Process invitation if token exists
//         if (inviteToken) {
//           await processInvitation(user.email, inviteToken, user._id);
//         }

//         const tokenData = {
//           email: user.email,
//           userId: user._id,
//         };
//         const token = simplejwt.sign(tokenData, process.env.JWT_SECRET);

//         // Redirect to frontend with token and any project ID if applicable
//         const redirectUrl = inviteToken
//           ? `${process.env.FRONT_APP_URL_DEV}/?token=${token}&inviteProcessed=true`
//           : `${process.env.FRONT_APP_URL_DEV}/?token=${token}`;

//         res.redirect(redirectUrl);
//       } else {
//         res.redirect(`${process.env.FRONT_APP_URL_DEV}`);
//       }
//     } catch (error) {
//       console.error("OAuth callback error:", error);
//       res.redirect(`${process.env.FRONT_APP_URL_DEV}/login?error=oauth_failed`);
//     }
//   }
// );

// // GitHub Login route
// router.get(
//   "/github",
//   passport.authenticate("github", {
//     scope: ["user:email"],
//   })
// );

// // GitHub callback route
// router.get(
//   "/github/callback",
//   passport.authenticate("github", {
//     failureRedirect: `${process.env.FRONT_APP_URL_DEV}`,
//   }),
//   async (req, res) => {
//     try {
//       const user = req.user;
//       const inviteToken = req.query.invite || req.query.state?.split("=")[1];

//       if (user) {
//         if (inviteToken) {
//           await processInvitation(user.email, inviteToken, user._id);
//         }

//         const tokenData = {
//           email: user.email,
//           userId: user._id,
//         };
//         const token = simplejwt.sign(tokenData, process.env.JWT_SECRET);

//         const redirectUrl = inviteToken
//           ? `${process.env.FRONT_APP_URL_DEV}/?token=${token}&inviteProcessed=true`
//           : `${process.env.FRONT_APP_URL_DEV}/?token=${token}`;

//         res.redirect(redirectUrl);
//       } else {
//         res.redirect(`${process.env.FRONT_APP_URL_DEV}`);
//       }
//     } catch (error) {
//       console.error("GitHub callback error:", error);
//       res.redirect(`${process.env.FRONT_APP_URL_DEV}/login?error=oauth_failed`);
//     }
//   }
// );

// Helper function to process invitations
// async function processInvitation(email, token, userId) {
//   try {
//     const invitation = await Invitation.findOne({ token });
//     if (!invitation) {
//       console.log("Invitation not found for token:", token);
//       return;
//     }

//     if (invitation.inviteeEmail.toLowerCase() !== email.toLowerCase()) {
//       console.log(
//         "Email mismatch for invitation:",
//         invitation.inviteeEmail,
//         "!=",
//         email
//       );
//       return;
//     }

//     const project = await Project.findById(invitation.project);
//     if (!project) {
//       console.log("Project not found for invitation:", invitation.project);
//       return;
//     }

//     if (!project.members.includes(userId)) {
//       project.members.push(userId);
//       await project.save();
//     }

//     invitation.status = "Accepted";
//     await invitation.save();
//     console.log("Successfully processed invitation for user:", userId);
//   } catch (error) {
//     console.error("Error processing invitation:", error);
//   }
// }

module.exports = router;
