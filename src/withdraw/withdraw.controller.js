const express = require("express");
const router = express.Router();
const jwt = require("../middleware/jwt");
const requestWithdraw = require("./requests/requestWithdraw");

router.post("/request", jwt, requestWithdraw);

module.exports = router;
