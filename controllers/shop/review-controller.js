import Product from "../../models/Product.js";

// POST /api/shop/products/:id/reviews
export const addProductReview = async (req, res) => {
  try {
    const productId = req.params.id;
    const { rating, comment } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!rating || !comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: "Rating and comment are required." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // Optional: prevent duplicate review by same user
    const existing = product.reviews?.find(
      (r) => r.userId?.toString() === req.user.id
    );
    if (existing) {
      return res.status(400).json({ success: false, message: "You already reviewed this product." });
    }

    const review = {
      userId: req.user.id,
      userName: req.user.userName || req.user.email || "Anonymous",
      rating: Number(rating),
      comment: comment.trim(),
      createdAt: new Date(),
    };

    product.reviews = product.reviews || [];
    product.reviews.push(review);

    // Recalculate averageReview
    const total = product.reviews.reduce((s, r) => s + (r.rating || 0), 0);
    product.averageReview = total / product.reviews.length;

    await product.save();

    // Return populated product so frontend can display new reviews immediately
    const populated = await Product.findById(product._id)
      .populate("categoryId", "name")
      .populate("brandId", "name")
      .populate("reviews.userId", "userName");

    res.status(200).json({
      success: true,
      message: "Review added",
      data: populated,
    });
  } catch (err) {
    console.error("addProductReview error:", err);
    res.status(500).json({ success: false, message: "Server error while adding review." });
  }
};
