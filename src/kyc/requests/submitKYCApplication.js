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

    // Get user with KYC history
    const user = await User.findById(req.user.userId);
    if (!user) {
      return sendErrorResponse(res, "User not found");
    }

    // Check if user has reached maximum KYC submissions (5)
    if (user.kycHistory && user.kycHistory.length >= 5) {
      return sendErrorResponse(
        res,
        "Maximum KYC submission limit reached (5 applications)"
      );
    }

    // Check if user has an existing KYC application that's not rejected
    if (user.kycId) {
      const existingKYC = await KYC.findById(user.kycId);
      if (existingKYC && existingKYC.status !== "rejected") {
        return sendErrorResponse(
          res,
          `Cannot resubmit KYC while current application is ${existingKYC.status}`
        );
      }
    }

    // Validate date of birth
    let dob;
    try {
      const dobString = dateOfBirth.includes("T")
        ? dateOfBirth.split("T")[0]
        : dateOfBirth;
      dob = new Date(dobString + "T12:00:00.000Z");

      if (isNaN(dob.getTime())) {
        throw new Error("Invalid date");
      }
    } catch (error) {
      return sendErrorResponse(
        res,
        "Invalid date of birth format. Please use YYYY-MM-DD format"
      );
    }

    // Create new KYC application
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

    // Update user's current KYC reference and add to history
    const updateData = {
      kycId: kycApplication._id,
      $push: { kycHistory: kycApplication._id },
    };

    await User.findByIdAndUpdate(req.user.userId, updateData);

    return sendSuccessResponse(res, "KYC application submitted successfully", {
      kycId: kycApplication._id,
      status: kycApplication.status,
      submittedAt: kycApplication.createdAt,
      totalSubmissions: (user.kycHistory ? user.kycHistory.length : 0) + 1,
      submissionsLeft: Math.max(
        0,
        5 - ((user.kycHistory ? user.kycHistory.length : 0) + 1)
      ),
    });
  } catch (error) {
    console.error("Error submitting KYC application:", error);
    return sendErrorResponse(res, "Error submitting KYC application");
  }
};

module.exports = submitKYCApplication;
