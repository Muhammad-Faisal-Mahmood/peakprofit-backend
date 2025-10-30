const User = require("../user.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const fs = require("fs");
const path = require("path");

module.exports = async (req, res) => {
  try {
    const { email } = req.user;

    if (!email) {
      return sendErrorResponse(res, "Authentication required");
    }

    const user = await User.findOne({ email });
    if (!user) {
      return sendErrorResponse(res, "User not found");
    }

    // Check if user already has default picture
    if (user.profilePicture === "default.jpg") {
      return sendErrorResponse(res, "No custom profile picture to remove");
    }

    // Extract filename if full URL is stored
    const currentPicture =
      user.profilePicture.includes("http") || user.profilePicture.includes("/")
        ? path.basename(user.profilePicture)
        : user.profilePicture;

    const imagePath = path.join(
      __dirname,
      "../../uploads/user",
      currentPicture
    );

    // Delete file if it exists
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Update user record to default image
    user.profilePicture = "default.jpg";
    await user.save();

    return sendSuccessResponse(res, "Profile picture removed successfully", {
      email: user.email,
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    console.error("Error removing profile picture:", error);
    return sendErrorResponse(
      res,
      "An error occurred while removing profile picture"
    );
  }
};
