import express from "express";
import {
  addToCart,
  fetchCartItems,
  deleteCartItem,
  updateCartItemQty,
  clearCart,
} from "../../controllers/shop/cart-controller.js";

const router = express.Router();

/**
 * 🛒 Final Correct Routes — match frontend Redux slice exactly
 */

// Add to cart
router.post("/add", addToCart);

// Fetch all user cart items
router.get("/get/:userId", fetchCartItems);

// Update quantity
router.put("/update", updateCartItemQty);

// Delete one cart item
router.delete("/:userId/:productId", deleteCartItem);

// Clear full cart
router.delete("/clear/:userId", clearCart);

export default router;
