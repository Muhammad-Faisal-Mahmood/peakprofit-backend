const Challenge = require("../challenge.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const getAllChallenges = async (req, res) => {
  try {
    const pageNo = parseInt(req.query.pageNo) || 1;
    const perPage = parseInt(req.query.perPage) || 10; // Default 10 items per page
    const search = req.query.search || null;

    // Build query
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Get paginated results
    const skip = (pageNo - 1) * perPage;

    const [challenges, totalCount] = await Promise.all([
      Challenge.find(query).sort({ createdAt: -1 }).skip(skip).limit(perPage),
      Challenge.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);

    return sendSuccessResponse(res, "Challenges retrieved successfully", {
      data: challenges,
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
    console.error("Error fetching challenges:", error);
    return sendErrorResponse(res, "Error retrieving challenges");
  }
};

module.exports = getAllChallenges;
