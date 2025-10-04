import express from "express";
import {
   getAllProducts,
  getProductById,
} from "../../controllers/shop/products-controller.js";

const router = express.Router();

// Public routes
router.get("/get", getAllProducts);
// ✅ FIX: The route now correctly listens for "/product-details/:id"
router.get("/product-details/:id", getProductById);

// Example of an admin-only route for adding products
// router.post("/add", protect, admin, addProduct);


module.exports = router;
