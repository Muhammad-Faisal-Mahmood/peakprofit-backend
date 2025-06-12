// const { sendErrorResponse } = require("../../shared/response.service");

// module.exports = (req, res, next) => {
//   console.log("req.body:", req.body);
//   console.log("req.file:", req.file);
//   const missingParams = [];
//   const requiredParams = ["fullname", "profilePicture"];

//   // Check for the required parameters in req.body
//   requiredParams.forEach((param) => {
//     if (!req.body[param]) {
//       missingParams.push(param);
//     }
//   });

//   if (missingParams.length > 0) {
//     return sendErrorResponse(
//       res,
//       `${missingParams.join(" and ")}: is required`
//     );
//   }

//   next();
// };

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
    const { fullname } = req.body;

    if (!email) {
      return sendErrorResponse(res, "Authentication required");
    }

    // Prepare update data
    const updateData = {};

    if (fullname) {
      updateData.name = fullname;
    }

    if (req.file) {
      // Get the old profile picture path if exists
      const user = await User.findOne({ email });
      if (user.profilePicture && user.profilePicture !== "default.jpg") {
        const oldImagePath = path.join(
          __dirname,
          "../uploads/user",
          user.profilePicture
        );
        // Delete old image if it exists
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Store both filename and full URL
      updateData.profilePicture = `${req.protocol}://${req.get(
        "host"
      )}/uploads/user/${req.file.filename}`;
    }

    // Update user in database
    const updatedUser = await User.findOneAndUpdate({ email }, updateData, {
      new: true,
    }).select("_id email name profilePicture profilePictureUrl");

    return sendSuccessResponse(res, "User updated successfully", updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return sendErrorResponse(res, "An error occurred while updating user");
  }
};
