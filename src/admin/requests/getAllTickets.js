const Ticket = require("../../ticket/ticket.model");
const User = require("../../user/user.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const getAllTickets = async (req, res) => {
  try {
    // Ensure user is admin
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized - Admin access required");
    }

    const pageNo = parseInt(req.query.pageNo) || 1;
    const perPage = parseInt(req.query.perPage) || 10;
    const search = req.query.search || null;
    const status = req.query.status ? req.query.status.toLowerCase() : null;
    const priority = req.query.priority
      ? req.query.priority.toLowerCase()
      : null;
    const category = req.query.category
      ? req.query.category.toLowerCase()
      : null;

    // Build query
    let query = {};

    // Add status filter if provided
    if (status) {
      const validStatuses = ["open", "in progress", "resolved", "closed"];
      if (!validStatuses.includes(status)) {
        return sendErrorResponse(
          res,
          "Invalid status filter. Allowed values are: open, in progress, resolved, closed"
        );
      }
      query.status = status;
    }

    // Add priority filter if provided
    if (priority) {
      const validPriorities = [
        "low",
        "medium",
        "high",
        "urgent",
        "not assigned",
      ];
      if (!validPriorities.includes(priority)) {
        return sendErrorResponse(
          res,
          "Invalid priority filter. Allowed values are: low, medium, high, urgent, not assigned"
        );
      }
      query.priority = priority;
    }

    // Add category filter if provided
    if (category) {
      const validCategories = ["technical", "billing", "general", "other"];
      if (!validCategories.includes(category)) {
        return sendErrorResponse(
          res,
          "Invalid category filter. Allowed values are: technical, billing, general, other"
        );
      }
      query.category = category;
    }

    const skip = (pageNo - 1) * perPage;

    if (search) {
      // Complex search across multiple fields including user data and internal notes
      const searchRegex = new RegExp(search, "i");

      // First, find users that match the search criteria
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
        ],
      }).select("_id");

      const matchingUserIds = matchingUsers.map((user) => user._id);

      // Build search query
      const searchQuery = {
        $or: [
          { subject: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { "internalNotes.note": { $regex: searchRegex } },
          { createdBy: { $in: matchingUserIds } },
        ],
      };

      // Combine with filter queries
      const finalQuery = { ...query, ...searchQuery };

      const [tickets, totalCount] = await Promise.all([
        Ticket.find(finalQuery)
          .populate("createdBy", "name email")
          .populate("replies.user", "name email")
          .populate("internalNotes.admin", "name email")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(perPage),
        Ticket.countDocuments(finalQuery),
      ]);

      const totalPages = Math.ceil(totalCount / perPage);

      return sendSuccessResponse(res, "Tickets retrieved successfully", {
        data: tickets,
        pagination: {
          currentPage: pageNo,
          perPage,
          totalItems: totalCount,
          totalPages,
          hasNextPage: pageNo < totalPages,
          hasPreviousPage: pageNo > 1,
        },
        filters: {
          search,
          status,
          priority,
          category,
        },
      });
    } else {
      // Simple query without search
      const [tickets, totalCount] = await Promise.all([
        Ticket.find(query)
          .populate("createdBy", "name email")
          .populate("replies.user", "name email")
          .populate("internalNotes.admin", "name email")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(perPage),
        Ticket.countDocuments(query),
      ]);

      const totalPages = Math.ceil(totalCount / perPage);

      return sendSuccessResponse(res, "Tickets retrieved successfully", {
        data: tickets,
        pagination: {
          currentPage: pageNo,
          perPage,
          totalItems: totalCount,
          totalPages,
          hasNextPage: pageNo < totalPages,
          hasPreviousPage: pageNo > 1,
        },
        filters: {
          status,
          priority,
          category,
        },
      });
    }
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return sendErrorResponse(res, "Error retrieving tickets");
  }
};

module.exports = getAllTickets;
