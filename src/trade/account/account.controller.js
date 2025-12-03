const express = require("express");
const router = express.Router();
const jwt = require("../../middleware/jwt");
const getUserAccounts = require("./requests/getUserAccounts");
const getAccountById = require("./requests/getAccountById");
const setSelectedAccount = require("./requests/setSelectedAccount");
const getAccountStats = require("./requests/getAccountStats");
const getDashboardChartStats = require("./requests/getDashboardChartStats");
const getStatsPageData = require("./requests/getStatsPageData");

router.get("/", jwt, getUserAccounts);
router.get("/:id", jwt, getAccountById);
router.post("/select", jwt, setSelectedAccount);
router.get("/:accountId/stats", jwt, getAccountStats);
router.get("/:accountId/dashboardChartStats", jwt, getDashboardChartStats);
router.get("/:accountId/statsPageData", jwt, getStatsPageData);

module.exports = router;
