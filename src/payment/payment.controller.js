const express = require("express");
const router = express.Router();
const jwt = require("../middleware/jwt");
const getUserPayments = require("./requests/getUserPayments");
const getUserPaymentById = require("./requests/getUserPaymentById");

router.get("/", jwt, getUserPayments);
router.get("/:paymentId", jwt, getUserPaymentById);
module.exports = router;
