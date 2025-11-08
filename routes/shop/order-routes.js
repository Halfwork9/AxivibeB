import express from "express";
import {
  createOrder,
  stripeWebhook,
  getAllOrdersByUser,
  getOrderDetails,
  verifyStripePayment,
  cancelOrder, 
  returnOrder,
} from "../../controllers/shop/order-controller.js";

const router = express.Router();

// Stripe checkout
router.post("/create", createOrder);

// Stripe webhook (⚠️ must use raw body middleware for Stripe)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// Orders
router.get("/list/:userId", getAllOrdersByUser);
router.get("/details/:id", getOrderDetails);
router.post("/verify-payment", verifyStripePayment);
router.put("/cancel/:orderId", cancelOrder);
router.put("/return/:orderId", returnOrder);

export default router;
