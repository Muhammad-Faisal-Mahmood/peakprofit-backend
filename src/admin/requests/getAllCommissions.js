const Commission = require("../../affiliate/commission/commission.model"); // Adjust path as needed
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const getAllCommissions = async (req, res) => {
  const VALID_TYPES = ["SIGNUP", "PURCHASE"];

  try {
    // Ensure user is admin
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized - Admin access required");
    }

    const pageNo = parseInt(req.query.pageNo) || 1;
    const perPage = parseInt(req.query.perPage) || 10;
    const search = req.query.search || null;
    const type = req.query.type ? req.query.type.toUpperCase() : null;
    const sortBy = req.query.sortBy || "earnedAt";
    const sortOrder = req.query.sortOrder || "desc";

    // Build query
    const query = {};

    // Add search functionality for affiliate name/email and referred user name/email
    if (search) {
      query.$or = [
        { "affiliate.userId.name": { $regex: search, $options: "i" } },
        { "affiliate.userId.email": { $regex: search, $options: "i" } },
      ];
    }

    // Filter by commission type
    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return sendErrorResponse(
          res,
          "Invalid type filter. Allowed values are: SIGNUP, PURCHASE"
        );
      }
      query.type = type;
    }

    const skip = (pageNo - 1) * perPage;

    // Build sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const [commissions, totalCount] = await Promise.all([
      Commission.find(query)
        .populate({
          path: "affiliate",
          populate: {
            path: "userId",
            select: "name email", // Only get name and email from User
          },
        })
        .populate({
          path: "referredUser",
          select: "name email", // Only get name and email from referred User
        })
        .populate({
          path: "challenge",
          select: "name cost", // Only get title and price from Challenge
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(perPage)
        .lean(), // Use lean for better performance
      Commission.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);

    // Format the commissions data for response
    const formattedCommissions = commissions.map((commission) => {
      const baseInfo = {
        id: commission._id,
        type: commission.type,
        amount: commission.amount,
        commissionPercentage: commission.commissionPercentage,
        affiliateTier: commission.affiliateTier,
        earnedAt: commission.earnedAt,
        referralCode: commission.metadata.referralCode,
        affiliate: commission.affiliate
          ? {
              id: commission.affiliate._id,
              name: commission.affiliate.userId?.name,
              email: commission.affiliate.userId?.email,
            }
          : null,
        referredUser: commission.referredUser
          ? {
              id: commission.referredUser._id,
              name: commission.referredUser.name,
              email: commission.referredUser.email,
            }
          : null,
      };

      if (commission.type === "PURCHASE") {
        return {
          ...baseInfo,
          challenge: commission.challenge
            ? {
                id: commission.challenge._id,
                name: commission.challenge.name,
                price: commission.challenge.cost,
              }
            : null,
          originalAmount: commission.originalAmount,
          formattedOriginalAmount: commission.originalAmount
            ? `$${commission.originalAmount.toFixed(2)}`
            : null,
          purchaseDate: commission.metadata.purchaseDate,
        };
      }

      return {
        ...baseInfo,
        userSignupDate: commission.metadata.userSignupDate,
      };
    });

    return sendSuccessResponse(res, "Commissions retrieved successfully", {
      data: formattedCommissions,
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
    console.error("Error fetching commissions:", error);
    return sendErrorResponse(res, "Error retrieving commissions");
  }
};

module.exports = getAllCommissions;
