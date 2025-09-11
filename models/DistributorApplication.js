import mongoose from "mongoose";

const distributorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // ✅ tie to user
      unique: true    // ✅ prevent multiple applications
    },
    company: { type: String, required: true },
    contactName: { type: String, required: true },
    title: String,
    email: { type: String, required: true },
    phone: { type: String, required: true },
    markets: { type: String, required: true },
    status: {
      type: String,
      enum: ["Submitted", "Approved", "Rejected"],
      default: "Submitted",
    },
  },
  { timestamps: true }
);

export default mongoose.model("DistributorApplication", distributorSchema);
