const express = require("express");
const router = express.Router();
const jwt = require("../middleware/jwt");
const buyChallenge = require("./requests/buyChallenge");
const getAllChallenges = require("./requests/getAllChallenges");

router.get("/challenges", getAllChallenges);
router.post("/purchase-challenge/:challengeId", jwt, buyChallenge);
module.exports = router;
