import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    // ✅ FIX: 'image' is now 'images' and stores multiple URLs
    image: {
      type: [String],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    price: { type: Number, required: true },
    salePrice: { type: Number, default: 0 },
    isOnSale: { type: Boolean, default: false },
    totalStock: { type: Number, default: 0 },
    averageReview: { type: Number, default: 0 },
    reviews: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userName: String,
        rating: Number,
        comment: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", ProductSchema);
export default Product;
