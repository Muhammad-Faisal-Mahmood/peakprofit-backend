const PolygonWebSocketManager = require("./polygonWebSocketManager");
const redis = require("../utils/redis.helper");

// Create singleton instance
const polygonManager = new PolygonWebSocketManager(process.env.POLYGON_API_KEY);

module.exports = { polygonManager };
