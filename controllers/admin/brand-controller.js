import Brand from "../../models/Brand.js";
import ProductCache from "../../models/ProductCache.js";
import { v2 as cloudinary } from "cloudinary";

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ---------------------------------------------------
   CREATE BRAND  — CLEAR CACHE
--------------------------------------------------- */
export const createBrand = async (req, res) => {
  try {
    const { name, icon } = req.body;
    let logoUrl = "";

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "brands",
      });
      logoUrl = result.secure_url;
    }

    const brand = await Brand.create({ name, icon, logo: logoUrl });

    // 🔥 Clear brand cache
    await ProductCache.deleteMany({ key: /brand-list:/ });
    console.log("🧹 Cleared brand cache (create)");

    res.status(201).json({ success: true, message: "Brand created", data: brand });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Brand already exists." });
    }
    console.error("Brand creation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ---------------------------------------------------
   GET ALL BRANDS — WITH CACHE
--------------------------------------------------- */
export const getAllBrands = async (req, res) => {
  try {
    const CACHE_KEY = `brand-list:all`;

    // 1️⃣ Check cache
    const cache = await ProductCache.findOne({ key: CACHE_KEY });
    if (cache && Date.now() - cache.updatedAt.getTime() < CACHE_TTL_MS) {
      console.log("📦 Brands served from cache");
      return res.json({ success: true, data: cache.data });
    }

    console.log("⚙️ Computing brand list...");

    const brands = await Brand.find().sort({ name: 1 });

    // 2️⃣ Save to cache
    await ProductCache.findOneAndUpdate(
      { key: CACHE_KEY },
      { data: brands, updatedAt: new Date() },
      { upsert: true }
    );

    console.log("✅ Brand list cached");

    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ---------------------------------------------------
   EDIT BRAND — CLEAR CACHE
--------------------------------------------------- */
export const editBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon } = req.body;
    const updateData = { name, icon };

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "brands",
      });
      updateData.logo = result.secure_url;
    }

    const brand = await Brand.findByIdAndUpdate(id, updateData, { new: true });

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    // 🔥 Clear brand cache
    await ProductCache.deleteMany({ key: /brand-list:/ });
   
    res.json({ success: true, message: "Brand updated", data: brand });
  } catch (error) {
    console.error("Edit brand error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ---------------------------------------------------
   DELETE BRAND — CLEAR CACHE
--------------------------------------------------- */
export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const brand = await Brand.findByIdAndDelete(id);

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    // 🔥 Clear brand cache
    await ProductCache.deleteMany({ key: /brand-list:/ });
   

    res.json({ success: true, message: "Brand deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
