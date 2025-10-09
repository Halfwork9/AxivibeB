// routes/shop/reviewRoutes.js
import express from "express";
import { addReview } from "../../controllers/shop/review-controller.js";
import { authMiddleware } from "../../controllers/auth/auth-controller.js"; // Ensure user is logged in

const router = express.Router();

// POST /api/shop/products/:productId/reviews
router.post("/products/:productId/reviews", authMiddleware, addReview);

export default router;
