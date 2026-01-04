const Affiliate = require("../../affiliate/affiliate.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const { Withdraw } = require("../../withdraw/withdraw.model");

const getAllAffiliates = async (req, res) => {
  const VALID_TIERS = ["bronze", "silver", "gold", "platinum"];

  try {
    // Ensure user is admin
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized - Admin access required");
    }

    const pageNo = parseInt(req.query.pageNo) || 1;
    const perPage = parseInt(req.query.perPage) || 10;
    const search = req.query.search || null;
    const tier = req.query.tier ? req.query.tier.toLowerCase() : null;

    // Build query
    const query = {};

    if (search) {
      // We need to populate user data to search by name and email
      // For now, we'll build a more complex aggregation pipeline
      const userSearchQuery = {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      };

      const matchStage = {
        $match: {
          $or: [
            { "user.email": { $regex: search, $options: "i" } },
            { "user.name": { $regex: search, $options: "i" } },
            { referralCode: { $regex: search, $options: "i" } },
          ],
        },
      };

      if (tier) {
        if (!VALID_TIERS.includes(tier)) {
          return sendErrorResponse(
            res,
            "Invalid tier filter. Allowed values are: bronze, silver, gold, platinum"
          );
        }
        matchStage.$match.tier = tier.toUpperCase();
      }

      const skip = (pageNo - 1) * perPage;

      const pipeline = [
        userSearchQuery,
        { $unwind: "$user" },
        matchStage,
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: perPage }],
            totalCount: [{ $count: "count" }],
          },
        },
      ];

      const [result] = await Affiliate.aggregate(pipeline);
      const affiliates = result.data;
      const totalCount = result.totalCount[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / perPage);

      return sendSuccessResponse(res, "Affiliates retrieved successfully", {
        data: affiliates,
        pagination: {
          currentPage: pageNo,
          perPage,
          totalItems: totalCount,
          totalPages,
          hasNextPage: pageNo < totalPages,
          hasPreviousPage: pageNo > 1,
        },
      });
    } else {
      // Simple query without search
      if (tier) {
        if (!VALID_TIERS.includes(tier)) {
          return sendErrorResponse(
            res,
            "Invalid tier filter. Allowed values are: bronze, silver, gold, platinum"
          );
        }
        query.tier = tier.toUpperCase();
      }

      const skip = (pageNo - 1) * perPage;

      const [affiliates, totalCount] = await Promise.all([
        Affiliate.find(query)
          .populate("userId", "name email profilePicture")
          .populate("referrals.referredUser", "name email") // who was referred
          .populate("referrals.purchases.challenge", "title price") // challenge details
          .populate({
            path: "withdraws",
            model: Withdraw,
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(perPage),
        Affiliate.countDocuments(query),
      ]);

      const totalPages = Math.ceil(totalCount / perPage);

      // Format the response data
      // const formattedAffiliates = affiliates.map((affiliate) => ({
      //   _id: affiliate._id,
      //   userId: affiliate.userId._id,
      //   user: {
      //     name: affiliate.userId.name,
      //     email: affiliate.userId.email,
      //     profilePicture: affiliate.userId.profilePicture,
      //   },
      //   tier: affiliate.tier,
      //   referralCode: affiliate.referralCode,
      //   referralLink: affiliate.referralLink,
      //   referrals: affiliate.referrals,
      //   referralsCount: affiliate.referrals.length,
      //   earnings: affiliate.earnings,
      //   commissionPercentage: affiliate.commissionPercentage,
      //   createdAt: affiliate.createdAt,
      //   updatedAt: affiliate.updatedAt,
      // }));

      return sendSuccessResponse(res, "Affiliates retrieved successfully", {
        data: affiliates,
        pagination: {
          currentPage: pageNo,
          itemsPerPage: perPage,
          totalItems: totalCount,
          totalPages,
          hasNextPage: pageNo < totalPages,
          hasPreviousPage: pageNo > 1,
        },
      });
    }
  } catch (error) {
    console.error("Error fetching affiliates:", error);
    return sendErrorResponse(res, "Error retrieving affiliates");
  }
};

module.exports = getAllAffiliates;
