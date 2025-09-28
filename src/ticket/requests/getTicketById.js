// getTicketById.js
const Ticket = require("../ticket.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const mongoose = require("mongoose");

module.exports = getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendErrorResponse(res, "Invalid ticket ID");
    }

    const ticket = await Ticket.findById(id)
      .populate("createdBy", "name email")
      .populate("replies.user", "name email role")
      .populate("internalNotes.admin", "name email");

    if (!ticket) {
      return sendErrorResponse(res, "Ticket not found");
    }

    // Check if user is authorized to view this ticket
    const isAdmin = req.user.role === "Admin";
    const isTicketOwner = ticket.createdBy._id.toString() === req.user.userId;

    if (!isAdmin && !isTicketOwner) {
      return sendErrorResponse(
        res,
        "Access denied. You can only view your own tickets."
      );
    }

    // If user is not admin, remove internal notes from response
    let responseTicket = ticket.toObject();
    if (!isAdmin) {
      delete responseTicket.internalNotes;
    }

    return sendSuccessResponse(
      res,
      "Ticket retrieved successfully",
      responseTicket
    );
  } catch (error) {
    console.error("Error retrieving ticket:", error);
    return sendErrorResponse(res, "Failed to retrieve ticket");
  }
};
