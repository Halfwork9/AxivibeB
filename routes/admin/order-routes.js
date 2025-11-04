// src/routes/admin/order.routes.js
import express from "express";
import {
  getAllOrdersOfAllUsers,
  getOrderDetailsForAdmin,
  updateOrderStatus,
  updatePaymentStatus,
  debugOrderStatuses,
} from "../../controllers/admin/order-controller.js";

import {
  getOrderStats,
  getSalesOverview,
} from "../../controllers/admin/order-stats-controller.js";

const router = express.Router();

// Existing admin order routes
router.get("/get", getAllOrdersOfAllUsers);
router.get("/details/:id", getOrderDetailsForAdmin);
router.put("/update/:id", updateOrderStatus);
router.put("/:id/payment-status", updatePaymentStatus);
router.get("/debug-statuses", debugOrderStatuses);

// ────── NEW ANALYTICS ROUTES ──────
router.get("/stats", getOrderStats);
router.get("/sales-overview", getSalesOverview);

export default router;
