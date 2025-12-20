const User = require("../../user/user.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const setUserStatus = async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return sendErrorResponse(
        res,
        "Access denied. Admin privileges required."
      );
    }
    const { userId, status } = req.body;
    if (!userId || !status) {
      return sendErrorResponse(res, "User ID and status are required.");
    }
    const user = await User.findById(userId);
    if (!user) {
      return sendErrorResponse(res, "User not found.");
    }
    if (!["Active", "Inactive"].includes(status)) {
      return sendErrorResponse(res, "Invalid status value.");
    }

    if (user.status === status) {
      return sendSuccessResponse(
        res,
        "User status is already set to the specified value.",
        user
      );
    }

    user.status = status;
    await user.save();
    sendSuccessResponse(res, "User status updated successfully.", user);
  } catch (error) {
    sendErrorResponse(res, "Error updating user status.");
  }
};
module.exports = setUserStatus;
