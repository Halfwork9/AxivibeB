import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    icon: { type: String, default: "" },
    logo: { type: String, default: "" }, // ✅ Add logo URL
  },
  { timestamps: true }
);

const Brand = mongoose.model("Brand", brandSchema);
export default Brand;
