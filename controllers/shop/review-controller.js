// controllers/shop/review-controller.js
import Product from "../../models/Product.js";

export const addReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user?.id; // ✅ You should have user info from middleware (JWT or session)

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Invalid rating value" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // ✅ Check if user already reviewed
    const existingReview = product.reviews.find(
      (r) => r.userId.toString() === userId.toString()
    );

    if (existingReview) {
      existingReview.rating = rating;
      existingReview.comment = comment;
    } else {
      product.reviews.push({ userId, rating, comment });
    }

    // ✅ Recalculate average rating
    const total = product.reviews.reduce((sum, r) => sum + r.rating, 0);
    product.averageReview = total / product.reviews.length;

    const updatedProduct = await product.save();

    await updatedProduct.populate("reviews.userId", "userName");

    res.status(200).json({
      success: true,
      message: "Review added successfully!",
      data: updatedProduct,
    });
  } catch (err) {
    console.error("Error adding review:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
