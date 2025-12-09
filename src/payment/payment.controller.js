const express = require("express");
const router = express.Router();
const jwt = require("../middleware/jwt");
const getUserPayments = require("./requests/getUserPayments");

router.get("/", jwt, getUserPayments);
module.exports = router;
