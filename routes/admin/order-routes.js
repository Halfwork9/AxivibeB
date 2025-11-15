// src/routes/admin/order.routes.js
import express from "express";
import {
  getAllOrdersOfAllUsers,
  getOrderDetailsForAdmin,
  updateOrderStatus,
  updatePaymentStatus,
  debugCategoryData,
} from "../../controllers/admin/order-controller.js";
import { clearDashboardCache } from "../../controllers/admin/cache-controller.js";
import {
  getOrderStats,
  getSalesOverview,
} from "../../controllers/admin/order-stats-controller.js";
import { getMonthlyRevenue } from "../../controllers/admin/order-stats-controller.js";

import mongoose from "mongoose";
import Order from "../../models/Order.js";

const router = express.Router();

// Existing admin order routes
router.get("/get", getAllOrdersOfAllUsers);
router.get("/details/:id", getOrderDetailsForAdmin);
router.put("/update/:id", updateOrderStatus);
router.put("/:id/payment-status", updatePaymentStatus);

// ────── NEW ANALYTICS ROUTES ──────
router.get("/stats", getOrderStats);
router.get("/sales-overview", getSalesOverview);
router.delete("/analytics/cache", clearDashboardCache);
router.get("/monthly-revenue", getMonthlyRevenue);

// ────── TEMP: FIX USER IDs (run once then delete) ──────
router.get("/fix-userids", async (req, res) => {
  try {
    const orders = await Order.find({});

    for (let order of orders) {
      if (typeof order.userId === "string") {
        try {
          order.userId = new mongoose.Types.ObjectId(order.userId);
          await order.save();
        } catch (e) {
          console.log("Error converting userId for order:", order._id);
        }
      }
    }

    return res.json({
      success: true,
      message: "✔ UserId fields converted to ObjectId",
    });
  } catch (err) {
    console.error("Fix UserIds error:", err);
    return res.json({
      success: false,
      message: "Failed to fix userId fields",
    });
  }
});

// (Keep this last)
export default router;
