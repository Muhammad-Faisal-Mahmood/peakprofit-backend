const express = require("express");
const router = express.Router();
const jwt = require("../../middleware/jwt");

const setInterval = require("./requests/setInterval");
const getInterval = require("./requests/getInterval");

router.post("/interval", jwt, setInterval);
router.get("/interval", jwt, getInterval);

module.exports = router;
