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
 * Cart Routes
 * Consistent with frontend Redux slice endpoints
 */

//  Add to cart
router.post("/add", addToCart);

//  Fetch user cart
router.get("/get/:userId", fetchCartItems);

//  Update cart quantity
router.put("/update", updateCartItemQty);

//  Delete specific product from cart
router.delete("/delete/:userId/:productId", deleteCartItem);

//  Clear entire cart
router.delete("/clear/:userId", clearCart);

export default router;
