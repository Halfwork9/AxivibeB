import Category from "../../models/Category.js";
import ProductCache from "../../models/ProductCache.js";

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/* ---------------------------------------------------
   CREATE CATEGORY — CLEAR CACHE
--------------------------------------------------- */
export const createCategory = async (req, res) => {
  try {
    const { name, icon } = req.body;

    const exists = await Category.findOne({ name });
    if (exists) {
      return res.status(400).json({ success: false, message: "Category already exists" });
    }

    const category = await Category.create({ name, icon });

    // 🔥 Clear category cache
    await ProductCache.deleteMany({ key: /category-list:/ });
    console.log("🧹 Cleared category cache (create)");

    res.status(201).json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ---------------------------------------------------
   GET ALL CATEGORIES — WITH CACHE
--------------------------------------------------- */
export const getAllCategories = async (req, res) => {
  try {
    const CACHE_KEY = `category-list:all`;

    // 1️⃣ Check cache
    const cache = await ProductCache.findOne({ key: CACHE_KEY });
    if (cache && Date.now() - cache.updatedAt.getTime() < CACHE_TTL_MS) {
      console.log("📦 Categories from cache");
      return res.json({ success: true, data: cache.data });
    }

    console.log("⚙️ Computing category list...");

    const categories = await Category.find().sort({ name: 1 });

    // 2️⃣ Save to cache
    await ProductCache.findOneAndUpdate(
      { key: CACHE_KEY },
      { data: categories, updatedAt: new Date() },
      { upsert: true }
    );

    console.log("✅ Category list cached");

    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ---------------------------------------------------
   DELETE CATEGORY — CLEAR CACHE
--------------------------------------------------- */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // 🔥 Clear category cache
    await ProductCache.deleteMany({ key: /category-list:/ });
   

    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
