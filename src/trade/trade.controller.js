const express = require("express");
const router = express.Router();

const openTrade = require("./requests/openTrade");
const jwt = require("../middleware/jwt");
const closeTrade = require("./requests/closeTrade");

router.post("/close", jwt, closeTrade);

router.post("/open", jwt, openTrade);
module.exports = router;
