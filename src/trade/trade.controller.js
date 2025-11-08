const express = require("express");
const router = express.Router();

const openTrade = require("./requests/openTrade");
const jwt = require("../middleware/jwt");

router.post("/open", jwt, openTrade);
module.exports = router;
