const User = require("../../user/user.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const getUserKYCHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Fetching KYC history for userId:", userId);
    if (req.user.role !== "Admin") {
      return sendErrorResponse(
        res,
        "Access denied. Admin privileges required."
      );
    }
    if (!userId) {
      return sendErrorResponse(res, "User ID is required.");
    }

    const user = await User.findById(userId).populate({
      path: "kycHistory",
      model: "KYC",
    });

    if (!user) {
      return sendErrorResponse(res, "User not found.");
    }
    return sendSuccessResponse(
      res,
      "KYC history fetched successfully.",
      user.kycHistory
    );
  } catch (error) {
    console.log("Error fetching KYC history:", error.message);
    return sendErrorResponse(res, "Could not fetch KYC history.");
  }
};

module.exports = getUserKYCHistory;
