const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const Contact = require("../../contact/contact.model");
const User = require("../../user/user.model");
const { sendEmail } = require("../../shared/mail.service");

const Reply = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "Admin") {
      return sendErrorResponse(
        res,
        "Unauthorized - Admin access required",
        403
      );
    }

    const { id } = req.params;
    const { subject, message } = req.body;

    // Validate required fields
    if (!subject || !message) {
      return sendErrorResponse(
        res,
        "Subject and message are required for reply",
        400
      );
    }

    // Get admin user details
    const adminUser = await User.findById(req.user.userId);
    if (!adminUser) {
      return sendErrorResponse(res, "Admin user not found", 404);
    }

    const contact = await Contact.findById(id);
    if (!contact) {
      return sendErrorResponse(res, "Contact not found", 404);
    }

    // Add the reply with admin details
    contact.replies.push({
      email: req.user.email, // From JWT
      name: adminUser.name, // From User model
      subject,
      message,
    });
    contact.status = "replied";

    // Save the contact first
    const updatedContact = await contact.save();

    // Send email to the original contact submitter
    try {
      await sendEmail(
        subject, // Email subject
        null, // No template file (we'll use raw HTML)
        contact.email, // Recipient (original contact submitter)
        {
          adminName: adminUser.name,
          adminEmail: req.user.email,
          originalSubject: contact.subject,
          originalMessage: contact.message,
          replyMessage: message,
          replyDate: new Date().toLocaleString(),
        },
        `<div>
          <h2>Re: ${contact.subject}</h2>
          <p>Dear ${contact.name},</p>
          <p>Thank you for your message. Here is our response:</p>
          <blockquote>${message}</blockquote>
          <p>Best regards,</p>
          <p>PeakProfit</p>
          <hr>
          <small>
            <p>Original message:</p>
            <p>Subject: ${contact.subject}</p>
            <p>${contact.message}</p>
          </small>
        </div>`
      );
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Don't fail the request if email fails, just log it
    }

    return sendSuccessResponse(
      res,
      "Reply added successfully, status updated, and notification email sent",
      updatedContact
    );
  } catch (error) {
    console.error("Error in reply process:", error);
    return sendErrorResponse(res, "Error processing reply", 500);
  }
};

module.exports = Reply;
