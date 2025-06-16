const UserService = require("../../user/user.service");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const getAllUsers = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized: Admins only.");
    }

    const pageNo = parseInt(req.query.pageNo) || 1;
    const search = req.query.search || null;

    const users = await UserService.list(pageNo, search);

    return sendSuccessResponse(res, "Users fetched successfully", users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return sendErrorResponse(res, "Failed to fetch users");
  }
};

module.exports = getAllUsers;
