import Product from "../../models/Product.js";
import ProductCache from "../../models/ProductCache.js";

// Cache TTL: 10 minutes
const CACHE_TTL_MS = 10 * 60 * 1000;

/* ---------------------------------------------------------
  ADD PRODUCT  (invalidate cache)
--------------------------------------------------------- */
export const addProduct = async (req, res) => {
  try {
    const {
      images,
      title,
      description,
      categoryId,
      brandId,
      price,
      salePrice,
      totalStock,
      isOnSale,
    } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required.",
      });
    }

    const newProduct = new Product({
      images,
      title,
      description,
      categoryId,
      brandId,
      price: Number(price),
      salePrice: isOnSale ? Number(salePrice) : 0,
      isOnSale: Boolean(isOnSale),
      totalStock: Number(totalStock),
    });

    await newProduct.save();

    // 🔥 Clear all admin product cache
    await ProductCache.deleteMany({ key: /admin-products:/ });
    console.log("🧹 Cleared admin product cache (add)");

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      data: newProduct,
    });
  } catch (e) {
    console.error("Add product error:", e);
    res.status(500).json({ success: false, message: "Error adding product" });
  }
};

/* ---------------------------------------------------------
  FETCH ALL PRODUCTS (Admin) — WITH CACHE
--------------------------------------------------------- */
export const fetchAllProducts = async (req, res) => {
  try {
    const {
      categoryId = "",
      brandId = "",
      isOnSale = "",
      page = 1,
      limit = 20,
    } = req.query;

    // Build Cache Key
    const CACHE_KEY = `admin-products:${categoryId}:${brandId}:${isOnSale}:${page}:${limit}`;

    // 1️⃣ Try Cache
    const cache = await ProductCache.findOne({ key: CACHE_KEY });

    if (cache && Date.now() - cache.updatedAt.getTime() < CACHE_TTL_MS) {
      console.log("📦 Admin products served from cache");
      return res.status(200).json({
        success: true,
        data: cache.data.products,
        pagination: cache.data.pagination,
      });
    }

    console.log("⚙️ Admin products recomputing...");

    // 2️⃣ Build Filters
    const filter = {};
    if (categoryId) filter.categoryId = categoryId;
    if (brandId) filter.brandId = brandId;
    if (isOnSale !== "") filter.isOnSale = isOnSale === "true";

    // 3️⃣ Query Products
    const products = await Product.find(filter)
      .populate("categoryId", "name")
      .populate("brandId", "name")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Product.countDocuments(filter);

    const responseData = {
      products,
      pagination: {
        total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
      },
    };

    // 4️⃣ Save Cache
    await ProductCache.findOneAndUpdate(
      { key: CACHE_KEY },
      { data: responseData, updatedAt: new Date() },
      { upsert: true }
    );

    console.log("✅ Admin products cached");

    res.status(200).json({
      success: true,
      data: products,
      pagination: responseData.pagination,
    });
  } catch (err) {
    console.error("Admin fetch error:", err);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};

/* ---------------------------------------------------------
  EDIT PRODUCT — CLEAR CACHE
--------------------------------------------------------- */
export const editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!updateData.images || updateData.images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required.",
      });
    }

    if (!updateData.isOnSale) updateData.salePrice = 0;

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // 🔥 Clear admin product cache
    await ProductCache.deleteMany({ key: /admin-products:/ });
    console.log("🧹 Cleared admin product cache (edit)");

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (e) {
    console.error("Edit product error:", e);
    res.status(500).json({ success: false, message: "Error editing product" });
  }
};

/* ---------------------------------------------------------
  DELETE PRODUCT — CLEAR CACHE
--------------------------------------------------------- */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // 🔥 Clear admin product cache
    await ProductCache.deleteMany({ key: /admin-products:/ });
    console.log("🧹 Cleared admin product cache (delete)");

    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (e) {
    console.error("Delete product error:", e);
    res.status(500).json({ success: false, message: "Error deleting product" });
  }
};
