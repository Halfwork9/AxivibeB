// src/models/AnalyticsCache.js
import mongoose from "mongoose";

const AnalyticsCacheSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  data: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("AnalyticsCache", AnalyticsCacheSchema);
