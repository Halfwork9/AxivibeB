const express = require("express");
const router = express.Router();
const {
  addProductReview,
  deleteProductReview,
} = require("../controllers/shop/reviewController");
const { protect, admin } = require("../middleware/authMiddleware"); // Assuming you have auth middleware

// Add a new review
router.route("/:productId/reviews").post(protect, addProductReview);

// Delete a review (Admin only)
router
  .route("/:productId/reviews/:reviewId")
  .delete(protect, admin, deleteProductReview);

module.exports = router;
