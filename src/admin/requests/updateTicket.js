// updateTicket.js
const Ticket = require("../../ticket/ticket.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const mongoose = require("mongoose");

module.exports = updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

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

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return sendErrorResponse(res, "Ticket not found");
    }

    // Validate and update status if provided
    if (status) {
      const validStatuses = ["open", "in progress", "resolved", "closed"];
      if (!validStatuses.includes(status?.toLowerCase())) {
        return sendErrorResponse(res, "Invalid status value");
      }

      ticket.status = status?.toLowerCase();

      // Set closedAt timestamp if status is closed or resolved
      if ((status === "closed" || status === "resolved") && !ticket.closedAt) {
        ticket.closedAt = new Date();
      }

      // Reopen ticket if status changes from closed/resolved to open/in progress
      if ((status === "open" || status === "in progress") && ticket.closedAt) {
        ticket.closedAt = null;
      }
    }

    // Validate and update priority if provided
    if (priority) {
      const validPriorities = [
        "low",
        "medium",
        "high",
        "urgent",
        "not assigned",
      ];
      if (!validPriorities.includes(priority.toLowerCase())) {
        return sendErrorResponse(res, "Invalid priority value");
      }
      ticket.priority = priority.toLowerCase();
    }
    // Save the updated ticket
    const updatedTicket = await ticket.save();

    // Populate relevant fields for response
    await updatedTicket.populate("createdBy", "name email");

    return sendSuccessResponse(
      res,
      "Ticket updated successfully",
      updatedTicket
    );
  } catch (error) {
    console.error("Error updating ticket:", error);
    return sendErrorResponse(res, "Failed to update ticket");
  }
};
