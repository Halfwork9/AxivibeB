import Order from "../../models/Order.js";
import ProductReview from "../../models/Review.js";

// Add a product review (only if user purchased)
export const addProductReview = async (req, res) => {
  try {
    const { productId, userId, userName, reviewMessage, reviewValue } = req.body;

    // Check if user purchased the product
    const order = await Order.findOne({
      userId,
      "cartItems.productId": productId,
    });

    if (!order) {
      return res.status(403).json({
        success: false,
        message: "You need to purchase product to review it.",
      });
    }

    // Check if review already exists
    const existingReview = await ProductReview.findOne({ productId, userId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You already reviewed this product!",
      });
    }

    // Create and save review
    const newReview = new ProductReview({
      productId,
      userId,
      userName,
      reviewMessage,
      reviewValue,
    });

    await newReview.save();

    res.status(201).json({ success: true, data: newReview });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Error" });
  }
};

// Get all reviews for a product
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await ProductReview.find({ productId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: reviews });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Error" });
  }
};
