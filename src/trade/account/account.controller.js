const express = require("express");
const router = express.Router();
const jwt = require("../../middleware/jwt");
const getUserAccounts = require("./requests/getUserAccounts");
const getAccountById = require("./requests/getAccountById");

router.get("/", jwt, getUserAccounts);
router.get("/:id", jwt, getAccountById);

module.exports = router;
