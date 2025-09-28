const Ticket = require("../ticket.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const ResponseCode = require("../../shared/ResponseCode");
const mongoose = require("mongoose");

// Create a new ticket
module.exports = createTicket = async (req, res) => {
  const VALID_CATEGORIES = ["technical", "billing", "general", "other"];
  try {
    // Check if user is authenticated
    if (!req.user.userId) {
      return sendErrorResponse(res, "Authentication required");
    }

    const { category, subject, description } = req.body;

    // Validate required fields
    if (!category || !subject || !description) {
      return sendErrorResponse(
        res,
        "Category, subject, and description are required"
      );
    }

    if (!VALID_CATEGORIES.includes(category.toLowerCase())) {
      return sendErrorResponse(res, "Invalid category.");
    }

    // Process attachments if any
    const attachments = [];
    const BACKEND_URL = process.env.BACKEND_URL;
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: BACKEND_URL + "/" + file.path,
          size: file.size,
        });
      });
    }

    // Create new ticket
    const ticket = new Ticket({
      _id: new mongoose.Types.ObjectId(),
      category: category.toLowerCase(),
      subject,
      description,
      attachments,
      createdBy: req.user.userId, // Assuming user ID is stored in req.userData
    });

    // Save ticket to database
    const savedTicket = await ticket.save();

    // Return success response
    return sendSuccessResponse(res, "Ticket created successfully", savedTicket);
  } catch (error) {
    console.error("Error creating ticket:", error);
    return sendErrorResponse(res, "Failed to create ticket");
  }
};
