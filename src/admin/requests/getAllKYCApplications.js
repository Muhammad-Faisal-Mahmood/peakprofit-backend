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
        $lookup: {
          from: "users",
          localField: "reviewedBy",
          foreignField: "_id",
          as: "reviewedBy",
        },
      },
      {
        $unwind: {
          path: "$reviewedBy",
          preserveNullAndEmptyArrays: true,
        },
      },
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

    const [applications, totalCountResult] = await Promise.all([
      KYC.aggregate([...pipeline, { $skip: skip }, { $limit: perPage }]),
      KYC.aggregate([...pipeline, { $count: "total" }]),
    ]);

    const totalCount =
      totalCountResult.length > 0 ? totalCountResult[0].total : 0;
    const totalPages = Math.ceil(totalCount / perPage);

    return sendSuccessResponse(res, "KYC applications retrieved successfully", {
      data: applications,
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
