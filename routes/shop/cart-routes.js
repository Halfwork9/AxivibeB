import express from "express";
import {
  addToCart,
  fetchCartItems,
  deleteCartItem,
  updateCartItemQty,
  clearCart,
} from "../../controllers/shop/cart-controller.js";

const router = express.Router();

// 🛒 Add item to cart
router.post("/add", addToCart);

// 🛒 Get user's cart
router.get("/get/:userId", fetchCartItems);

// 🛒 Update quantity
router.put("/update", updateCartItemQty);

// 🛒 Delete single item (IMPORTANT: must come before /clear)
router.delete("/:userId/:productId", deleteCartItem);

// 🧹 Clear full cart
router.delete("/clear/:userId", clearCart);

export default router;
