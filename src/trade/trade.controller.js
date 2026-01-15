const express = require("express");
const router = express.Router();

const placeOrder = require("./requests/placeOrder");
const jwt = require("../middleware/jwt");
const closeTrade = require("./requests/closeTrade");
const cancelOrder = require("./requests/cancelOrder");
const editTrade = require("./requests/editTrade");

router.post("/close", jwt, closeTrade);

router.post("/place", jwt, placeOrder);
router.post("/cancel", jwt, cancelOrder);
router.put("/edit", jwt, editTrade);
module.exports = router;
