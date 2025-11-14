const express = require("express");
const router = express.Router();

const placeOrder = require("./requests/placeOrder");
const jwt = require("../middleware/jwt");
const closeTrade = require("./requests/closeTrade");
const cancelOrder = require("./requests/cancelOrder");

router.post("/close", jwt, closeTrade);

router.post("/place", jwt, placeOrder);
router.post("/cancel", jwt, cancelOrder);
module.exports = router;
