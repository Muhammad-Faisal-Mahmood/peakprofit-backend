const { Withdraw } = require("../../withdraw/withdraw.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const getAllAffiliateWithdraws = async (req, res) => {
  const VALID_STATUSES = ["PENDING", "APPROVED", "DENIED", "PAID"];

  try {
    // Ensure user is admin
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized - Admin access required");
    }

    const pageNo = parseInt(req.query.pageNo) || 1;
    const perPage = parseInt(req.query.perPage) || 10;
    const search = req.query.search || null;
    const status = req.query.status ? req.query.status.toUpperCase() : null;

    // Build base query for status filter
    const query = {};

    // Filter by status
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return sendErrorResponse(
          res,
          "Invalid status filter. Allowed values are: PENDING, APPROVED, DENIED, PAID"
        );
      }
      query.status = status;
    }

    const skip = (pageNo - 1) * perPage;

    // Get counts for all status types
    const statusCounts = await Withdraw.aggregate([
      {
        $match: { affiliateId: { $ne: null } }, // Add this filter
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Convert the counts array to an object for easy access
    const counts = {
      PENDING: 0,
      APPROVED: 0,
      DENIED: 0,
      PAID: 0,
      TOTAL: 0,
    };

    statusCounts.forEach((item) => {
      counts[item._id] = item.count;
      counts.TOTAL += item.count;
    });

    // Build aggregation pipeline for search functionality
    const pipeline = [];

    // First, populate the affiliateId and userId
    pipeline.push(
      { $match: { affiliateId: { $ne: null } } },
      {
        $lookup: {
          from: "affiliates", // Make sure this matches your actual collection name
          localField: "affiliateId",
          foreignField: "_id",
          as: "affiliate",
        },
      },
      {
        $lookup: {
          from: "users", // Make sure this matches your actual collection name
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $lookup: {
          from: "users", // Lookup for affiliate's user details
          localField: "affiliate.userId",
          foreignField: "_id",
          as: "affiliateUser",
        },
      },
      {
        $lookup: {
          from: "challenges", // Make sure this matches your actual collection name
          localField: "challengeId",
          foreignField: "_id",
          as: "challenge",
        },
      }
    );

    // Apply status filter if provided
    if (status) {
      pipeline.push({
        $match: { affiliateId: { $ne: null } }, // Add this filter

        $match: { status: status },
      });
    }

    // Apply search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "affiliateUser.name": { $regex: search, $options: "i" } },
            { "affiliateUser.email": { $regex: search, $options: "i" } },
            { "user.name": { $regex: search, $options: "i" } },
            { "user.email": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Add pagination
    pipeline.push(
      { $sort: { requestedDate: -1 } },
      { $skip: skip },
      { $limit: perPage }
    );

    // Execute the aggregation
    const withdraws = await Withdraw.aggregate(pipeline);

    // Get total count for pagination (need separate query for count)
    const countPipeline = [];

    // Same lookups for counting
    countPipeline.push(
      { $match: { affiliateId: { $ne: null } } },
      {
        $lookup: {
          from: "affiliates",
          localField: "affiliateId",
          foreignField: "_id",
          as: "affiliate",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "affiliate.userId",
          foreignField: "_id",
          as: "affiliateUser",
        },
      }
    );

    // Apply same filters for counting
    if (status) {
      countPipeline.push({
        $match: { status: status },
      });
    }

    if (search) {
      countPipeline.push({
        $match: {
          $or: [
            { "affiliateUser.name": { $regex: search, $options: "i" } },
            { "affiliateUser.email": { $regex: search, $options: "i" } },
            { "user.name": { $regex: search, $options: "i" } },
            { "user.email": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    countPipeline.push({ $count: "total" });

    const countResult = await Withdraw.aggregate(countPipeline);
    const totalCount = countResult.length > 0 ? countResult[0].total : 0;

    const totalPages = Math.ceil(totalCount / perPage);

    // Format the withdraws data for response
    const formattedWithdraws = withdraws.map((withdraw) => {
      const affiliate = withdraw.affiliate?.[0];
      const affiliateUser = withdraw.affiliateUser?.[0];
      const user = withdraw.user?.[0];
      const challenge = withdraw.challenge?.[0];

      return {
        id: withdraw._id,
        amount: withdraw.amount,
        status: withdraw.status,
        requestedDate: withdraw.requestedDate,
        processedDate: withdraw.processedDate,
        transactionRef: withdraw.transactionRef,

        // Affiliate Details
        affiliate: {
          id: affiliate?._id,
          affiliateId: affiliate?.affiliateId,
          name: affiliateUser?.name,
          email: affiliateUser?.email,
        },

        // User Details (the one who made the withdrawal request)
        user: {
          id: user?._id,
          name: user?.name,
          email: user?.email,
        },

        // Challenge Details (if applicable)
        challenge: challenge
          ? {
              id: challenge._id,
              name: challenge.name,
              cost: challenge.cost,
            }
          : null,

        // Payment Method Details
        paymentMethod: {
          type: withdraw.paymentMethod.type,
          accountNumber: withdraw.paymentMethod.accountNumber,
          routingNumber: withdraw.paymentMethod.routingNumber,
          bankName: withdraw.paymentMethod.bankName,
          accountHolderName: withdraw.paymentMethod.accountHolderName,
          paypalEmail: withdraw.paymentMethod.paypalEmail,
          stripeAccountId: withdraw.paymentMethod.stripeAccountId,
          walletAddress: withdraw.paymentMethod.walletAddress,
          cryptoType: withdraw.paymentMethod.cryptoType,
          details: withdraw.paymentMethod.details,
        },
      };
    });

    return sendSuccessResponse(
      res,
      "Affiliate withdraws retrieved successfully",
      {
        data: formattedWithdraws,
        counts: {
          pending: counts.PENDING,
          approved: counts.APPROVED,
          denied: counts.DENIED,
          paid: counts.PAID,
          total: counts.TOTAL,
        },
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
    console.error("Error fetching affiliate withdraws:", error);
    return sendErrorResponse(res, "Error retrieving affiliate withdraws");
  }
};

module.exports = getAllAffiliateWithdraws;
