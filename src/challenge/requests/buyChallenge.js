const Challenge = require("../challenge.model");
const {
  sendErrorResponse,
  sendSuccessResponse,
} = require("../../shared/response.service");
const affiliateService = require("../../affiliate/affiliate.service");
const buyChallenge = async (req, res) => {
  const { challengeId } = req.params;
  const userId = req.user.userId;

  try {
    // Get challenge details
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return sendErrorResponse(res, "Challenge not found");
    }

    // Process the purchase (your existing logic here)
    // ... purchase processing logic ...

    // Process affiliate commission if user was referred
    await affiliateService.processPurchase(userId, challengeId, challenge.cost);

    return sendSuccessResponse(res, "Challenge purchased successfully", {
      challenge: challenge,
      cost: challenge.cost,
    });
  } catch (error) {
    console.error("Error processing challenge purchase:", error);
    return sendErrorResponse(
      res,
      `Failed to purchase challenge: ${error.message}`
    );
  }
};

module.exports = buyChallenge;
