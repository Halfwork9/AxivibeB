// src/routes/shop/products.js
import express from "express";
import {
  getAllProducts,
  getProductById, // <-- your function name
} from "../../controllers/shop/products-controller.js";

const router = express.Router();

router.get("/products/get", getAllProducts);
router.get("/product-details/:id", getProductById); // <-- FIX: match frontend

export default router;
