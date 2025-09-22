const KYC = require("../../kyc/kyc.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const getAllKYCApplications = async (req, res) => {
  const VALID_STATUSES = ["pending", "approved", "rejected"];

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

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return sendErrorResponse(
          res,
          "Invalid status filter. Allowed values are: pending, approved, rejected"
        );
      }
      query.status = status;
    }

    // Build search conditions for populated user fields
    let matchConditions = {};

    if (search) {
      matchConditions.$or = [
        { "user.email": { $regex: search, $options: "i" } },
        { "user.name": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (pageNo - 1) * perPage;

    // Use aggregation for better search functionality with populated fields
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      ...(Object.keys(matchConditions).length > 0
        ? [{ $match: matchConditions }]
        : []),
      {
        $project: {
          _id: 1,
          user: {
            _id: "$user._id",
            name: "$user.name",
            email: "$user.email",
          },
          dateOfBirth: 1,
          socials: 1,
          idFrontImage: 1,
          idBackImage: 1,
          status: 1,
          rejectionReason: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    // Get status counts (all statuses regardless of search/filter)
    const statusCountsPipeline = [
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
    ];

    // Add search conditions to status counts if search is provided
    if (search) {
      statusCountsPipeline.push({
        $match: {
          $or: [
            { "user.email": { $regex: search, $options: "i" } },
            { "user.name": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    statusCountsPipeline.push({
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    });

    const [applications, totalCountResult, statusCountsResult] =
      await Promise.all([
        KYC.aggregate([...pipeline, { $skip: skip }, { $limit: perPage }]),
        KYC.aggregate([...pipeline, { $count: "total" }]),
        KYC.aggregate(statusCountsPipeline),
      ]);

    const totalCount =
      totalCountResult.length > 0 ? totalCountResult[0].total : 0;
    const totalPages = Math.ceil(totalCount / perPage);

    // Process status counts
    const statusCounts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      all: 0,
    };

    // Update counts from aggregation result
    statusCountsResult.forEach((item) => {
      if (VALID_STATUSES.includes(item._id)) {
        statusCounts[item._id] = item.count;
      }
    });

    // Calculate total (all)
    statusCounts.all =
      statusCounts.pending + statusCounts.approved + statusCounts.rejected;

    const BACKEND_URL = process.env.BACKEND_URL;

    // Prepend backend URL to image paths
    const applicationsWithFullImageUrls = applications.map((application) => ({
      ...application,
      idFrontImage: `${BACKEND_URL}/uploads/kyc/${application.idFrontImage}`,
      idBackImage: `${BACKEND_URL}/uploads/kyc/${application.idBackImage}`,
    }));

    return sendSuccessResponse(res, "KYC applications retrieved successfully", {
      data: applicationsWithFullImageUrls,
      counts: statusCounts,
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
    console.error("Error fetching KYC applications:", error);
    return sendErrorResponse(res, "Error retrieving KYC applications");
  }
};

module.exports = getAllKYCApplications;
