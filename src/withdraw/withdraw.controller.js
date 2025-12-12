const express = require("express");
const router = express.Router();
const jwt = require("../middleware/jwt");
const requestWithdraw = require("./requests/requestWithdraw");
const getTradingPayoutsHistory = require("./requests/getTradingPayoutsHistory");

router.post("/request", jwt, requestWithdraw);
router.get("/trading-payouts-history", jwt, getTradingPayoutsHistory);
module.exports = router;
