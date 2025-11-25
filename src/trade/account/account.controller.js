const express = require("express");
const router = express.Router();
const jwt = require("../../middleware/jwt");
const getUserAccounts = require("./requests/getUserAccounts");
const getAccountById = require("./requests/getAccountById");
const setSelectedAccount = require("./requests/setSelectedAccount");
const getAccountStats = require("./requests/getAccountStats");

router.get("/", jwt, getUserAccounts);
router.get("/:id", jwt, getAccountById);
router.post("/select", jwt, setSelectedAccount);
router.get("/:accountId/stats", jwt, getAccountStats);

module.exports = router;
