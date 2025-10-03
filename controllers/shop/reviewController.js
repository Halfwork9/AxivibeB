const Product = require("../models/Product");
const User = require("../models/User"); // Assuming you have a User model

// @desc    Add a new review to a product
// @route   POST /api/shop/products/:productId/reviews
// @access  Private
const addProductReview = async (req, res) => {
  const { rating, comment } = req.body;
  const { productId } = req.params;
  const userId = req.user._id; // Assumes you have middleware to get the logged-in user

  if (!rating) {
    return res.status(400).json({ message: "Rating is required" });
  }

  try {
    const product = await Product.findById(productId);
    const user = await User.findById(userId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
     if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === userId.toString()
    );

    if (alreadyReviewed) {
       // Update the existing review
      alreadyReviewed.rating = Number(rating);
      alreadyReviewed.comment = comment;
    } else {
      // Add a new review
      const review = {
        user: userId,
        userName: user.userName, // Get username from your User model
        rating: Number(rating),
        comment,
      };
      product.reviews.push(review);
    }

    // Recalculate average review
    const totalReviews = product.reviews.length;
    product.averageReview =
      product.reviews.reduce((acc, item) => item.rating + acc, 0) /
      totalReviews;

    await product.save();

    // Refetch the product to populate user details in reviews for the response
    const updatedProduct = await Product.findById(productId)
      .populate("categoryId", "name")
      .populate("brandId", "name");

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Delete a product review
// @route   DELETE /api/shop/products/:productId/reviews/:reviewId
// @access  Private/Admin
const deleteProductReview = async (req, res) => {
  const { productId, reviewId } = req.params;

  try {
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Find the review to delete
    const reviewExists = product.reviews.find(
      (r) => r._id.toString() === reviewId.toString()
    );

    if (!reviewExists) {
        return res.status(404).json({ message: 'Review not found' });
    }

    // Remove the review from the array
    product.reviews = product.reviews.filter(
      (r) => r._id.toString() !== reviewId.toString()
    );

    // Recalculate average review
    if (product.reviews.length > 0) {
        product.averageReview =
            product.reviews.reduce((acc, item) => item.rating + acc, 0) /
            product.reviews.length;
    } else {
        product.averageReview = 0;
    }

    await product.save();

     const updatedProduct = await Product.findById(productId)
      .populate("categoryId", "name")
      .populate("brandId", "name");

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  addProductReview,
  deleteProductReview,
};
