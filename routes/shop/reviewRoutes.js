import express from "express";
import { addReview } from "../../controllers/shop/review-controller.js";
import { authMiddleware } from "../../middleware/authMiddleware.js"; // Corrected middleware import path

const router = express.Router();

// ✅ FIX: The route is now '/:productId/reviews'
// This will correctly combine with the base path in server.js to become:
// POST /api/shop/products/:productId/reviews
router.post("/:productId/reviews", authMiddleware, addReview);

export default router;
