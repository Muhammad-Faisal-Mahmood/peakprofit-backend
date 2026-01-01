// routes/chartStorage.js
const express = require("express");
const router = express.Router();
const ChartLayout = require("./chartLayout.model");
const jwt = require("../../middleware/jwt");

// ============================================================
// ENDPOINT 1: GET ALL CHARTS (List saved layouts)
// ============================================================
// GET /charts?client=CLIENT_ID&user=USER_ID
router.get("/charts", jwt, async (req, res) => {
  try {
    const { client } = req.query;
    const user = req.user.userId;

    // Validation
    if (!client || !user) {
      return res.json({
        status: "error",
        message: "Missing client or user parameter",
      });
    }

    // Find all charts for this user
    const charts = await ChartLayout.find({
      clientId: client,
      userId: user,
    })
      .select("chartId name symbol resolution timestamp")
      .sort({ timestamp: -1 }); // Most recent first

    // Format response according to TradingView spec
    const formattedCharts = charts.map((chart) => ({
      id: chart.chartId,
      name: chart.name,
      symbol: chart.symbol,
      resolution: chart.resolution,
      timestamp: Math.floor(chart.timestamp.getTime() / 1000), // Unix timestamp
    }));

    res.json({
      status: "ok",
      data: formattedCharts,
    });
  } catch (error) {
    console.error("Error fetching charts:", error);
    res.json({
      status: "error",
      message: error.message,
    });
  }
});

// ============================================================
// ENDPOINT 2: GET SPECIFIC CHART (Load a saved layout)
// ============================================================
// GET /charts/:chartId?client=CLIENT_ID&user=USER_ID
router.get("/charts/:chartId", jwt, async (req, res) => {
  try {
    const { client } = req.query;
    const { chartId } = req.params;
    const user = req.user.userId;

    // Validation
    if (!client || !user) {
      return res.json({
        status: "error",
        message: "Missing client or user parameter",
      });
    }

    // Find the specific chart
    const chart = await ChartLayout.findOne({
      clientId: client,
      userId: user,
      chartId: chartId,
    });

    if (!chart) {
      return res.json({
        status: "error",
        message: "Chart not found",
      });
    }

    // Return complete chart data including content (drawings, indicators, etc.)
    res.json({
      status: "ok",
      data: {
        id: chart.chartId,
        name: chart.name,
        symbol: chart.symbol,
        resolution: chart.resolution,
        content: chart.content, // THIS CONTAINS EVERYTHING including drawings
        timestamp: Math.floor(chart.timestamp.getTime() / 1000),
      },
    });
  } catch (error) {
    console.error("Error fetching chart:", error);
    res.json({
      status: "error",
      message: error.message,
    });
  }
});

// ============================================================
// ENDPOINT 3: SAVE CHART (Create or update a layout)
// ============================================================
// POST /charts?client=CLIENT_ID&user=USER_ID&chart=CHART_ID
// Body: { name, symbol, resolution, content }
router.post("/charts", jwt, async (req, res) => {
  try {
    const { client, chart: chartId } = req.query;
    const { name, symbol, resolution, content } = req.body;
    const user = req.user.userId;

    // Validation
    if (!client || !user || !chartId) {
      return res.json({
        status: "error",
        message: "Missing required parameters",
      });
    }

    if (!name || !symbol || !resolution || !content) {
      return res.json({
        status: "error",
        message: "Missing required fields in body",
      });
    }

    // Check if chart already exists
    let chart = await ChartLayout.findOne({
      clientId: client,
      userId: user,
      chartId: chartId,
    });

    if (chart) {
      // UPDATE existing chart
      chart.name = name;
      chart.symbol = symbol;
      chart.resolution = resolution;
      chart.content = content; // This includes all drawings
      chart.timestamp = new Date();
      await chart.save();

      console.log(`Chart ${chartId} updated for user ${user}`);
    } else {
      // CREATE new chart
      chart = await ChartLayout.create({
        clientId: client,
        userId: user,
        chartId: chartId,
        name: name,
        symbol: symbol,
        resolution: resolution,
        content: content,
        timestamp: new Date(),
      });

      console.log(`Chart ${chartId} created for user ${user}`);
    }

    res.json({
      status: "ok",
      id: chart.chartId,
    });
  } catch (error) {
    console.error("Error saving chart:", error);
    res.json({
      status: "error",
      message: error.message,
    });
  }
});

// ============================================================
// ENDPOINT 4: DELETE CHART (Remove a saved layout)
// ============================================================
// DELETE /charts/:chartId?client=CLIENT_ID&user=USER_ID
router.delete("/charts/:chartId", jwt, async (req, res) => {
  try {
    const { client } = req.query;
    const { chartId } = req.params;
    const user = req.user.userId;

    // Validation
    if (!client || !user) {
      return res.json({
        status: "error",
        message: "Missing client or user parameter",
      });
    }

    // Delete the chart
    const result = await ChartLayout.deleteOne({
      clientId: client,
      userId: user,
      chartId: chartId,
    });

    if (result.deletedCount === 0) {
      return res.json({
        status: "error",
        message: "Chart not found",
      });
    }

    console.log(`Chart ${chartId} deleted for user ${user}`);

    res.json({
      status: "ok",
    });
  } catch (error) {
    console.error("Error deleting chart:", error);
    res.json({
      status: "error",
      message: error.message,
    });
  }
});

module.exports = router;
