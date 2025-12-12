const Account = require("../account.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");

const getAccountsPayoutInfo = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch all live accounts
    const accounts = await Account.find({
      userId: userId,
      accountType: "live",
    }).sort({ createdAt: -1 });

    if (!accounts || accounts.length === 0) {
      return sendSuccessResponse(res, "No live accounts found", {
        accounts: [],
        totalAvailablePayout: 0,
        nextGlobalPayoutDate: null,
      });
    }

    let totalAvailablePayout = 0;
    let nextPayoutDates = [];

    const formattedAccounts = accounts.map((account) => {
      const acc = account.toObject();

      // --- Profit ---
      const profit = account.balance - account.initialBalance;

      // --- Available payout ---
      const availablePayoutAmount = account.getAvailablePayoutAmount();
      totalAvailablePayout += availablePayoutAmount;

      // --- Eligibility (from your model) ---
      const eligibility = account.canRequestPayout();

      // --- Next payout date (5-day cycle) ---
      let nextPayoutDate = null;
      let daysLeft = 0;
      let hoursLeft = 0;

      if (eligibility.eligible) {
        nextPayoutDate = new Date(); // right now
      } else if (account.lastPayoutDate) {
        nextPayoutDate = new Date(account.lastPayoutDate);
        nextPayoutDate.setDate(nextPayoutDate.getDate() + 5);

        const timeLeftMs = nextPayoutDate - Date.now();
        if (timeLeftMs > 0) {
          const totalHoursLeft = Math.ceil(timeLeftMs / (1000 * 60 * 60));
          daysLeft = Math.floor(totalHoursLeft / 24);
          hoursLeft = totalHoursLeft % 24;
        }
      }

      if (nextPayoutDate) {
        nextPayoutDates.push(nextPayoutDate);
      }

      return {
        ...acc,
        profit: availablePayoutAmount,
        isEligible: eligibility.eligible,
        nextPayoutDate,
        nextPayoutIn: {
          days: daysLeft,
          hours: hoursLeft,
        },
      };
    });

    // --- Global soonest payout date across all accounts ---
    let nextGlobalPayoutDate = null;
    if (nextPayoutDates.length > 0) {
      nextGlobalPayoutDate = new Date(Math.min(...nextPayoutDates));
    }

    return sendSuccessResponse(res, "Live accounts payout info fetched", {
      accounts: formattedAccounts,
      totalAvailablePayout,
      nextGlobalPayoutDate,
    });
  } catch (error) {
    console.error("Error fetching live account payout info:", error);
    return sendErrorResponse(res, "Failed to fetch live account payout info");
  }
};

module.exports = getAccountsPayoutInfo;
