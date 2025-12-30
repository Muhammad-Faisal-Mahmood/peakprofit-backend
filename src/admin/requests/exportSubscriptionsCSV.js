const {
  
  sendErrorResponse,
} = require("../../shared/response.service");
const Subscription = require("../../subscription/subscription.model");

const exportSubscriptionsCSV = async (req, res) => {
  try {
    // Admin check
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized: Admins only.");
    }

    // Fetch all subscriptions
    const subscriptions = await Subscription.find({})
      .sort({ createdAt: -1 })
      .select("email createdAt")
      .lean();

    // CSV Header
    let csv = "Email,Subscribed At\n";

    // CSV Rows
    subscriptions.forEach((sub) => {
      const date = new Date(sub.createdAt).toISOString().split("T")[0];
      csv += `"${sub.email}","${date}"\n`;
    });

    // Set headers for file download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=subscriptions.csv"
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Error exporting subscriptions CSV:", error);
    return sendErrorResponse(res, "Failed to export subscriptions");
  }
};

module.exports = exportSubscriptionsCSV;
