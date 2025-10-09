import express from "express";
import {
  getAllProducts,
  getProductById,
} from "../../controllers/shop/products-controller.js";

const router = express.Router();

// Route for getting all products
// Handles GET /api/shop/products/get
router.get("/get", getAllProducts);

// ✅ FIX: This now matches the URL your frontend is calling
// Handles GET /api/shop/products/product-details/:id
router.get("/product-details/:id", getProductById);

export default router;
