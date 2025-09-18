const mongoose = require("mongoose");
const KYC = require("../kyc.model");
const User = require("../../user/user.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const submitKYCApplication = async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.userId) {
      return sendErrorResponse(res, "Authentication required");
    }

    const { dateOfBirth, socials } = req.body;

    // Validate required fields
    if (!dateOfBirth || !socials) {
      return sendErrorResponse(res, "Date of birth and socials are required");
    }

    // Validate files are uploaded
    if (!req.files || !req.files.idFrontImage || !req.files.idBackImage) {
      return sendErrorResponse(
        res,
        "Both ID front and back images are required"
      );
    }

    // Check if user already has a KYC application
    const existingKYC = await KYC.findOne({ user: req.user.userId });
    if (existingKYC) {
      return sendErrorResponse(
        res,
        "KYC application already exists for this user"
      );
    }

    // Validate date of birth
    let dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      return sendErrorResponse(res, "Invalid date of birth format");
    }

    try {
      // Parse as date only (not datetime) to avoid timezone issues
      const dobString = dateOfBirth.includes("T")
        ? dateOfBirth.split("T")[0]
        : dateOfBirth;
      dob = new Date(dobString + "T12:00:00.000Z"); // Set to noon UTC to avoid timezone shifts

      if (isNaN(dob.getTime())) {
        throw new Error("Invalid date");
      }
    } catch (error) {
      return sendErrorResponse(
        res,
        "Invalid date of birth format. Please use YYYY-MM-DD format"
      );
    }

    // Check if user is at least 18 years old
    // const eighteenYearsAgo = new Date();
    // eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    // if (dob > eighteenYearsAgo) {
    //   return sendErrorResponse(res, "User must be at least 18 years old");
    // }

    // Create KYC application
    const kycApplication = new KYC({
      _id: new mongoose.Types.ObjectId(),
      user: req.user.userId,
      dateOfBirth: dob,
      socials,
      idFrontImage: req.files.idFrontImage[0].filename,
      idBackImage: req.files.idBackImage[0].filename,
      status: "pending",
    });

    await kycApplication.save();

    // Update user's KYC reference
    await User.findByIdAndUpdate(req.user.userId, {
      kycId: kycApplication._id,
    });

    return sendSuccessResponse(res, "KYC application submitted successfully", {
      kycId: kycApplication._id,
      status: kycApplication.status,
      submittedAt: kycApplication.createdAt,
    });
  } catch (error) {
    console.error("Error submitting KYC application:", error);
    return sendErrorResponse(res, "Error submitting KYC application");
  }
};

module.exports = submitKYCApplication;
