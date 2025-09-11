import express from "express";
import {
  createOrder,
  stripeWebhook,
  getAllOrdersByUser,
  getOrderDetails,
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

export default router;
