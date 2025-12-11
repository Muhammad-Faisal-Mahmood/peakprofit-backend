const {
  sendErrorResponse,
  sendSuccessResponse,
} = require("../../shared/response.service");
const challengeBuyingService = require("../../utils/challengeBuying.service");
const buyChallenge = async (req, res) => {
  const { challengeId } = req.params;
  const userId = req.user.userId;

  try {
    const result = await challengeBuyingService(challengeId, userId);

    return sendSuccessResponse(res, "Challenge purchased successfully", result);
  } catch (error) {
    console.error("Error processing challenge purchase:", error);
    return sendErrorResponse(
      res,
      `Failed to purchase challenge: ${error.message}`
    );
  }
};

module.exports = buyChallenge;
