import mongoose from "mongoose";

const ProductCacheSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  data: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("ProductCache", ProductCacheSchema);
