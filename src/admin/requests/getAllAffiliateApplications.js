const AffiliateApplication = require("../../affiliate/affiliateApplication.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const getAllAffiliateApplications = async (req, res) => {
  const VALID_STATUSES = ["pending", "accepted", "rejected"];

  try {
    // Ensure user is admin
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized - Admin access required");
    }

    const pageNo = parseInt(req.query.pageNo) || 1;
    const perPage = parseInt(req.query.perPage) || 10;
    const search = req.query.search || null;
    const status = req.query.status ? req.query.status.toLowerCase() : null;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return sendErrorResponse(
          res,
          "Invalid status filter. Allowed values are: pending, accepted, rejected"
        );
      }
      query.status = status;
    }

    const skip = (pageNo - 1) * perPage;

    const [applications, totalCount] = await Promise.all([
      AffiliateApplication.find(query) // populate user info if available
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage),
      AffiliateApplication.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);

    return sendSuccessResponse(
      res,
      "Affiliate applications retrieved successfully",
      {
        data: applications,
        pagination: {
          currentPage: pageNo,
          perPage,
          totalItems: totalCount,
          totalPages,
          hasNextPage: pageNo < totalPages,
          hasPreviousPage: pageNo > 1,
        },
      }
    );
  } catch (error) {
    console.error("Error fetching affiliate applications:", error);
    return sendErrorResponse(res, "Error retrieving affiliate applications");
  }
};

module.exports = getAllAffiliateApplications;
