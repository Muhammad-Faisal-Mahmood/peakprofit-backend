// addReply.js
const Ticket = require("../ticket.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const mongoose = require("mongoose");

module.exports = addReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendErrorResponse(res, "Invalid ticket ID");
    }

    if (!message || message.trim().length === 0) {
      return sendErrorResponse(res, "Message is required");
    }

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return sendErrorResponse(res, "Ticket not found");
    }

    if (ticket.status === "closed") {
      return sendErrorResponse(res, "Cannot reply to a closed ticket");
    }

    // Check if user is authorized to reply to this ticket
    const isAdmin = req.user.role === "Admin";
    const isTicketOwner = ticket.createdBy.toString() === req.user.userId;

    if (!isAdmin && !isTicketOwner) {
      return sendErrorResponse(
        res,
        "Access denied. You can only reply to your own tickets."
      );
    }

    // Process attachments if any
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
        });
      });
    }

    // Create reply object
    const reply = {
      user: req.user.userId,
      message: message.trim(),
      isFromSupport: isAdmin,
      attachments,
    };

    // Add reply to ticket
    ticket.replies.push(reply);

    // Update ticket status if reply is from support
    if (isAdmin && ticket.status === "open") {
      ticket.status = "in progress";
    }

    // Save the updated ticket
    const updatedTicket = await ticket.save();

    // Populate user details in the response
    await updatedTicket.populate("replies.user", "name email role");

    return sendSuccessResponse(res, "Reply added successfully", updatedTicket);
  } catch (error) {
    console.error("Error adding reply:", error);
    return sendErrorResponse(res, "Failed to add reply");
  }
};
