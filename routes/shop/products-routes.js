import express from "express";
import {
  getAllProducts,
  getProductById,
} from "../../controllers/shop/products-controller.js";
import { addReview } from "../../controllers/shop/review-controller.js";
import { authMiddleware } from "../../controllers/auth/auth-controller.js";
import ProductCache from "../../models/ProductCache.js";

const router = express.Router();

// 🛍️ Fetch all products
router.get("/get", getAllProducts);

// 🛒 Get single product details
router.get("/product-details/:id", getProductById);

// ⭐ Add product review
router.post("/:productId/reviews", authMiddleware, addReview);

router.delete("/clear-cache", async (req, res) => {
  await ProductCache.deleteMany({});
  res.json({ success: true, message: "Product cache cleared" });
});

export default router;
