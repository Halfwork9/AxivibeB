// src/controllers/admin/cache-controller.js
import AnalyticsCache from "../../models/AnalyticsCache.js";

/**
 * DELETE /admin/analytics/cache
 * Clears dashboard and sales overview cache
 */
export const clearDashboardCache = async (req, res) => {
  try {
    await AnalyticsCache.deleteMany({
      key: { $in: ["admin:order_stats", "admin:sales_overview"] },
    });

    console.log("🧹 Cleared dashboard caches manually");

    return res.json({
      success: true,
      message: "Dashboard cache cleared successfully",
    });
  } catch (error) {
    console.error("clearDashboardCache ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear cache",
    });
  }
};
