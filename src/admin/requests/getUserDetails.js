const User = require("../../user/user.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.role !== "Admin") {
      return sendErrorResponse(
        res,
        "Access denied. Admin privileges required."
      );
    }
    if (!userId) {
      return sendErrorResponse(res, "User ID is required.");
    }
    const user = await User.findById(userId);
    if (!user) {
      return sendErrorResponse(res, "User not found.");
    }
  } catch (error) {
    return sendErrorResponse(
      res,
      "An error occurred while fetching user details."
    );
  }
};

module.exports = getUserDetails;
