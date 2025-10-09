// controllers/shop/review-controller.js
import Product from "../../models/Product.js";

export const addReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;

    // 1️⃣ Ensure user is logged in
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 2️⃣ Validate input
    if (!rating || !comment?.trim()) {
      return res.status(400).json({ success: false, message: "Rating and comment are required." });
    }

    // 3️⃣ Find the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // Initialize reviews array if missing
    product.reviews = product.reviews || [];

    // 4️⃣ Optional: prevent duplicate review from same user
    const existingReview = product.reviews.find(
      (r) => r.userId?.toString() === req.user.id
    );
    if (existingReview) {
      return res.status(400).json({ success: false, message: "You already reviewed this product." });
    }

    // 5️⃣ Add new review
    const newReview = {
      userId: req.user.id,
      userName: req.user.userName || req.user.email,
      rating: Number(rating),
      comment: comment.trim(),
      createdAt: new Date(),
    };

    product.reviews.push(newReview);

    // 6️⃣ Update average rating
    const total = product.reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    product.averageReview = total / product.reviews.length;

    await product.save();

    // 7️⃣ Populate category/brand for frontend display
    const updatedProduct = await Product.findById(productId)
      .populate("categoryId", "name")
      .populate("brandId", "name");

    return res.status(200).json({
      success: true,
      message: "Review added successfully",
      data: updatedProduct,
    });
  } catch (err) {
    console.error("❌ addReview error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while adding review",
      error: err.message,
    });
  }
};
