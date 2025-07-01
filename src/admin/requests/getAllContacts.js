const Contact = require("../../contact/contact.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const getAllContacts = async (req, res) => {
  try {
    console.log("req.user: ", req.user);
    // Check if user is admin
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized - Admin access required");
    }

    const pageNo = parseInt(req.query.pageNo) || 1;
    const perPage = parseInt(req.query.perPage) || 10; // Default 10 items per page
    const search = req.query.search || null;
    const status = req.query.status || null;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    // Get paginated results
    const skip = (pageNo - 1) * perPage;

    const [contacts, totalCount] = await Promise.all([
      Contact.find(query).sort({ createdAt: -1 }).skip(skip).limit(perPage),
      Contact.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);

    return sendSuccessResponse(res, "Contacts retrieved successfully", {
      data: contacts,
      pagination: {
        currentPage: pageNo,
        perPage,
        totalItems: totalCount,
        totalPages,
        hasNextPage: pageNo < totalPages,
        hasPreviousPage: pageNo > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return sendErrorResponse(res, "Error retrieving contacts");
  }
};

module.exports = getAllContacts;
