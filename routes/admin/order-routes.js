import express from "express";
import {
  getAllOrdersOfAllUsers,
  getOrderDetailsForAdmin,
  updateOrderStatus,
   updatePaymentStatus,
} from "../../controllers/admin/order-controller.js";
import {
  getOrderStats,
  getSalesOverview,
  debugOrders,
} from "../../controllers/admin/order-stats-controller.js";

const router = express.Router();

router.get("/get", getAllOrdersOfAllUsers);
router.get("/details/:id", getOrderDetailsForAdmin);
router.put("/update/:id", updateOrderStatus);

// 📊 New Analytics Routes
router.get("/stats", getOrderStats);
router.get("/sales-overview", getSalesOverview);
router.put("/:id/payment-status", updatePaymentStatus);
// In your admin order routes file
router.get("/debug", debugOrders);

export default router;
