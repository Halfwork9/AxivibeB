import mongoose from "mongoose";

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
    averageReview: {
      type: Number,
      default: 0,
    },
    reviews: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        userName: String,
        rating: Number,
        comment: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", ProductSchema);
export default Product;
