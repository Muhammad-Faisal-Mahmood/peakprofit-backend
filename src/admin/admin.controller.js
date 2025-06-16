const express = require("express");
const router = express.Router();
const jwt = require("../middleware/jwt");
const getAllUsers = require("./requests/getAllUsers");
const getSubscriptions = require("./requests/getSubscriptions");

router.get("/users", jwt, getAllUsers);
router.get("/subscriptions", jwt, getSubscriptions);

module.exports = router;
