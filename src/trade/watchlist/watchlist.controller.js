const express = require("express");
const router = express.Router();
const jwt = require("../../middleware/jwt");
const addToWatchlist = require("./requests/add");
const getWatchlist = require("./requests/get");
const removeFromWatchlist = require("./requests/delete");

// Add item to watchlist
router.post("/items", jwt, addToWatchlist);

// Get user's watchlist
router.get("/", jwt, getWatchlist);

// Remove item from watchlist
router.delete("/items/:symbol", jwt, removeFromWatchlist);

module.exports = router;
