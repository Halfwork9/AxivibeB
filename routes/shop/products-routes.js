import express from "express";
import {
  getAllProducts,
  getProductById,
} from "../../controllers/shop/products-controller.js";
import { addReview } from "../../controllers/shop/review-controller.js";
import { authMiddleware } from "../../controllers/auth/auth-controller.js";
import ProductCache from "../../models/ProductCache.js";

const router = express.Router();

// 🛍️ Fetch all products (cached)
router.get("/get", getAllProducts);

// 🛒 Product details (cached)
router.get("/product-details/:id", getProductById);

// ⭐ Add review
router.post("/:productId/reviews", authMiddleware, addReview);

// 🧹 Clear product cache
router.delete("/clear-cache", async (req, res) => {
  try {
    await ProductCache.deleteMany({});
    console.log("🧹 Product cache cleared");
    return res.json({ success: true, message: "Product cache cleared" });
  } catch (err) {
    console.error("❌ Error clearing product cache:", err);
    return res.status(500).json({ success: false, message: "Failed to clear cache" });
  }
});

export default router;
