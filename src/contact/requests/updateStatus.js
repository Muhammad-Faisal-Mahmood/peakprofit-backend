const Contact = require("../contact.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const updateContactStatus = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized - Admin access required");
    }

    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (status != "viewed") {
      return sendErrorResponse(res, "Invalid status.");
    }

    const updatedContact = await Contact.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedContact) {
      return sendErrorResponse(res, "Contact not found");
    }

    return sendSuccessResponse(
      res,
      "Contact status updated successfully",
      updatedContact
    );
  } catch (error) {
    return sendErrorResponse(
      res,
      `Error updating contact status: ${error.message}`
    );
  }
};

module.exports = updateContactStatus;
