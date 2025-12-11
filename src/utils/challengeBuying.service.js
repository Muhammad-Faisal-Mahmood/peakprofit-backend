const Challenge = require("../challenge/challenge.model");
const affiliateService = require("../affiliate/affiliate.service");
const createAccount = require("./createAccount");
const challengeBuyingService = async (
  challengeId,
  userId,
  accountType = "demo"
) => {
  try {
    // Get challenge details
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return new Error("Challenge not found");
    }

    // Process the purchase (your existing logic here)
    // ... purchase processing logic ...

    const newAccount = await createAccount({
      userId,
      challengeId: challenge._id,
      accountType: accountType, // or "evaluation" depending on your flow
    });

    // Process affiliate commission if user was referred
    await affiliateService.processPurchase(userId, challengeId, challenge.cost);

    return {
      account: newAccount,
      challenge: challenge,
      cost: challenge.cost,
    };
  } catch (error) {
    console.error("Error processing challenge purchase:", error);
    return error;
  }
};

module.exports = challengeBuyingService;
