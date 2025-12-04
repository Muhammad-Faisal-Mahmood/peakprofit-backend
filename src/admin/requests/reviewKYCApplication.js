const KYC = require("../../kyc/kyc.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const { sendEmail } = require("../../shared/mail.service");
const path = require("path");

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

    if (updatedKYC.status === "approved") {
      await sendKYCApprovalEmail(updatedKYC);
    } else if (updatedKYC.status === "rejected") {
      await sendKYCRejectionEmail(updatedKYC);
    }
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

async function sendKYCApprovalEmail(kycApplication) {
  try {
    const user = kycApplication.user;

    if (!user || !user.email) {
      throw new Error("User email not found");
    }

    // Extract first name from full name or use email username
    const firstName = user.name
      ? user.name.split(" ")[0]
      : user.email.split("@")[0];

    // Format approval date
    const approvalDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Generate reference ID using KYC ID
    const referenceId = `KYC-${kycApplication._id.toString()}`;

    const replacements = {
      first_name: firstName,
      kyc_approval_date: approvalDate,
      kyc_reference_id: referenceId,
      year: new Date().getFullYear(),
      unsubscribe_url: "#", // Placeholder until unsubscribe functionality is implemented
    };

    const template = path.join(__dirname, "..", "mails", "kycApproved.html");

    await sendEmail(
      "Your KYC Has Been Approved ✔",
      template,
      user.email,
      replacements
    );

    console.log(`KYC approval email sent to ${user.email}`);
  } catch (error) {
    console.error("Error sending KYC approval email:", error);
    throw error;
  }
}

async function sendKYCRejectionEmail(kycApplication) {
  try {
    const User = require("../../user/user.model");

    const user = kycApplication.user;

    if (!user || !user.email) {
      throw new Error("User email not found");
    }

    // Fetch full user data to check kycHistory
    const fullUser = await User.findById(user._id).select("kycHistory");

    if (!fullUser) {
      throw new Error("User not found");
    }

    // Extract first name from full name or use email username
    const firstName = user.name
      ? user.name.split(" ")[0]
      : user.email.split("@")[0];

    // Format submission date (using createdAt from KYC document)
    const submissionDate = new Date(
      kycApplication.createdAt
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Generate reference ID using KYC ID
    const referenceId = `KYC-${kycApplication._id
      .toString()
      .slice(-8)
      .toUpperCase()}`;

    // Determine if user can resubmit based on kycHistory length
    // User can resubmit if kycHistory has less than 5 entries
    const kycHistoryCount = fullUser.kycHistory
      ? fullUser.kycHistory.length
      : 0;
    const canResubmit = kycHistoryCount < 5 ? "Yes" : "No";

    const resubmitInstructions =
      canResubmit === "Yes"
        ? "You can resubmit your KYC documents directly through your dashboard. Please address the issues mentioned below before resubmitting."
        : "Unfortunately, you have reached the maximum number of KYC submission attempts (5). Please contact our support team for further assistance.";

    const replacements = {
      first_name: firstName,
      email: user.email,
      kyc_submission_date: submissionDate,
      kyc_reference_id: referenceId,
      denial_reason:
        kycApplication.rejectionReason ||
        "Documents did not meet verification requirements",
      can_resubmit: canResubmit,
      resubmit_instructions: resubmitInstructions,
      support_ticket_link: "", // Add your support ticket URL if available
      year: new Date().getFullYear(),
      unsubscribe_url: "#", // Placeholder until unsubscribe functionality is implemented
    };

    const template = path.join(__dirname, "..", "mails", "kycDeclined.html");

    await sendEmail(
      "Your KYC Submission - Action Required",
      template,
      user.email,
      replacements
    );

    console.log(
      `KYC rejection email sent to ${user.email} (Resubmit allowed: ${canResubmit})`
    );
  } catch (error) {
    console.error("Error sending KYC rejection email:", error);
    throw error;
  }
}

module.exports = reviewKYCApplication;
