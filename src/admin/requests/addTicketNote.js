// addInternalNote.js
const Ticket = require("../../ticket/ticket.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const mongoose = require("mongoose");

const addTicketNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    // Check if user is admin
    if (req.user.role !== "Admin") {
      return sendErrorResponse(
        res,
        "Access denied. Admin privileges required."
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendErrorResponse(res, "Invalid ticket ID");
    }

    if (!note || note.trim().length === 0) {
      return sendErrorResponse(res, "Note content is required");
    }

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return sendErrorResponse(res, "Ticket not found");
    }

    if (ticket.status === "closed") {
      return sendErrorResponse(res, "Cannot add notes to a closed ticket");
    }

    // Create internal note object
    const internalNote = {
      admin: req.user.userId,
      note: note.trim(),
    };

    // Add internal note to ticket
    ticket.internalNotes.push(internalNote);

    // Save the updated ticket
    const updatedTicket = await ticket.save();

    // Populate admin details in the response
    await updatedTicket.populate("internalNotes.admin", "name email");

    return sendSuccessResponse(
      res,
      "Internal note added successfully",
      updatedTicket
    );
  } catch (error) {
    console.error("Error adding internal note:", error);
    return sendErrorResponse(res, "Failed to add internal note");
  }
};

module.exports = addTicketNote;
