const express = require("express");
const router = express.Router();
const Subscription = require("./subscription.model");
const { sendEmail } = require("../shared/mail.service");
const path = require("path");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../shared/response.service");

// POST endpoint to create a new subscription
router.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return sendErrorResponse(res, "Email is required");
    }

    // Check if email already exists
    const existingSubscription = await Subscription.findOne({ email });
    if (existingSubscription) {
      return sendErrorResponse(res, "This email is already subscribed");
    }

    // Create new subscription
    const newSubscription = new Subscription({ email });
    await newSubscription.save();

    // Send welcome email
    await sendWelcomeEmail(email);

    return sendSuccessResponse(
      res,
      "Subscription successful! Welcome email sent.",
      { email }
    );
  } catch (error) {
    console.error("Error creating subscription:", error);
    return sendErrorResponse(res, "Internal server error");
  }
});

// Function to send welcome email
async function sendWelcomeEmail(email) {
  try {
    const replacements = {
      name: email.split("@")[0], // Extract name from email
      supportEmail:
        process.env.SUPPORT_EMAIL || "support@peakprofitfunding.com",
      websiteUrl: process.env.WEBSITE_URL || "https://peakprofitfunding.com",
      dashboardUrl:
        process.env.DASHBOARD_URL || "https://dashboard.peakprofitfunding.com",
      EMAIL: email,
    };

    const template = path.join(__dirname, "mails", "welcome-subscriber-2.html");

    await sendEmail("Welcome to Peak Profit!", template, email, replacements);

    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw error;
  }
}

module.exports = router;
