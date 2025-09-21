const Ticket = require("../ticket.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const ResponseCode = require("../../shared/ResponseCode");
const mongoose = require("mongoose");

module.exports = getUserTickets = async (req, res) => {
  try {
    if (!req.user.userId) {
      return sendErrorResponse(res, "Authentication required");
    }

    const page = parseInt(req.query.pageNo) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Extract search and filter parameters from query
    const { search, category, status } = req.query;

    // Build the filter object
    let filter = { createdBy: req.user.userId };

    // Add search filter if provided
    if (search) {
      const searchRegex = new RegExp(search, "i"); // Case-insensitive search
      filter.$or = [
        { subject: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
      ];
    }

    // Add category filter if provided
    if (category) {
      filter.category = category.toLowerCase();
    }

    // Add status filter if provided
    if (status) {
      filter.status = status.toLowerCase();
    }

    // Get tickets with search and filters applied
    const tickets = await Ticket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "name email");

    // Get total count with the same filters
    const total = await Ticket.countDocuments(filter);

    return sendSuccessResponse(res, "Tickets retrieved successfully", {
      tickets,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTickets: total,
      filters: {
        search: search || "",
        category: category?.toLowerCase() || "",
        status: status?.toLowerCase() || "",
      },
    });
  } catch (error) {
    console.error("Error retrieving tickets:", error);
    return sendErrorResponse(res, "Failed to retrieve tickets");
  }
};
