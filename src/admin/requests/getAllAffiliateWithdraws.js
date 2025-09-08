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

    // Build query
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

    // Add search functionality for affiliate name/email
    if (search) {
      query.$or = [
        { "affiliateDetails.name": { $regex: search, $options: "i" } },
        { "affiliateDetails.email": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (pageNo - 1) * perPage;

    // Get counts for all status types
    const statusCounts = await Withdraw.aggregate([
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

    const [withdraws, totalCount] = await Promise.all([
      Withdraw.find(query)
        .populate({
          path: "userId",
          select: "name email",
        })
        .populate({
          path: "affiliateId",
          select: "affiliateId",
          populate: {
            path: "userId",
            select: "name email",
          },
        })
        .populate({
          path: "challengeId",
          select: "name cost",
        })
        .sort({ requestedDate: -1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      Withdraw.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);

    // Format the withdraws data for response
    const formattedWithdraws = withdraws.map((withdraw) => {
      const affiliate = withdraw.affiliateId;
      const user = withdraw.userId;

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
          name: affiliate?.userId?.name,
          email: affiliate?.userId?.email,
        },

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
