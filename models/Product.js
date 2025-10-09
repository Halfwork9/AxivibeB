import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    image: String,
    title: String,
    description: String,
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    price: Number,
    salePrice: Number,
    totalStock: Number,
    averageReview: Number,

    // ✅ Add reviews array
    reviews: [reviewSchema],
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", ProductSchema);
export default Product;
