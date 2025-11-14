import Product from "../../models/Product.js";
import mongoose from "mongoose";
import ProductCache from "../../models/ProductCache.js";
// @desc    Fetch all filtered products
// @route   GET /api/shop/products/get
// @access  Public
// CACHE TTL = 10 minutes
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// @desc    Fetch products with filters + caching
// @route   GET /api/shop/products/get
// @access  Public
export const getAllProducts = async (req, res) => {
  try {
    const {
      category = "",
      brand = "",
      sortBy = "price-lowtohigh",
      page = 1,
      limit = 20,
      isOnSale,
      priceRange,
      rating,
    } = req.query;

    // ----------------------------
    // Build unique CACHE KEY
    // ----------------------------
    const CACHE_KEY = `products:${category}:${brand}:${sortBy}:${page}:${limit}:${isOnSale}:${priceRange}:${rating}`;

    // ----------------------------
    // 1️⃣ Check MongoDB Cache
    // ----------------------------
    const cache = await ProductCache.findOne({ key: CACHE_KEY });

    if (cache && Date.now() - cache.updatedAt.getTime() < CACHE_TTL_MS) {
      console.log("📦 Products served from cache");
      return res.status(200).json(cache.response);
    }

    console.log("⚙️ Recomputing product list...");

    // ----------------------------
    // 2️⃣ Build Filters
    // ----------------------------
    let filters = { isDeleted: { $ne: true } };

    // CATEGORY
    if (category) {
      filters.categoryId = { $in: category.split(",") };
    }

    // BRAND
    if (brand) {
      filters.brandId = { $in: brand.split(",") };
    }

    // ON SALE
    if (isOnSale === "true") {
      filters.isOnSale = true;
    }

    // PRICE RANGE
    if (priceRange) {
      const [min, max] = priceRange.split(",").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        filters.price = { $gte: min, $lte: max };
      }
    }

    // RATING
    if (rating) {
      filters.averageReview = { $gte: Number(rating) };
    }

    // ----------------------------
    // 3️⃣ Sorting Logic
    // ----------------------------
    let sort = {};
    switch (sortBy) {
      case "price-lowtohigh":
        sort.price = 1;
        break;
      case "price-hightolow":
        sort.price = -1;
        break;
      case "title-atoz":
        sort.title = 1;
        break;
      case "title-ztoa":
        sort.title = -1;
        break;
      case "newest":
        sort.createdAt = -1;
        break;
      default:
        sort.price = 1;
    }

    // ----------------------------
    // 4️⃣ Pagination
    // ----------------------------
    const skip = (page - 1) * limit;

    const totalProducts = await Product.countDocuments(filters);

    const products = await Product.find(filters)
      .populate("categoryId", "name")
      .populate("brandId", "name")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const totalPages = Math.ceil(totalProducts / limit);

    const response = {
      success: true,
      data: products,
      pagination: {
        totalProducts,
        totalPages,
        currentPage: Number(page),
        limit: Number(limit),
      },
    };

    // ----------------------------
    // 5️⃣ Save to Cache
    // ----------------------------
    await ProductCache.findOneAndUpdate(
      { key: CACHE_KEY },
      { response, updatedAt: new Date() },
      { upsert: true }
    );

    console.log("✅ Products computed & cached");

    return res.status(200).json(response);
  } catch (e) {
    console.error("Error in getAllProducts:", e);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


// @desc    Fetch single product by ID
// @route   GET /api/shop/products/product-details/:id
// @access  Public
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID format" });
    }

    const CACHE_KEY = `product:${id}`;

    // 1️⃣ Check cache
    const cache = await ProductCache.findOne({ key: CACHE_KEY });
    if (cache && Date.now() - cache.updatedAt.getTime() < CACHE_TTL_MS) {
      console.log("📦 Product details served from cache");
      return res.status(200).json({ success: true, data: cache.data });
    }

    console.log("⚙️ Fetching product details from DB...");

    const product = await Product.findById(id)
      .populate("categoryId", "name")
      .populate("brandId", "name")
      .populate("reviews.userId", "userName")
      .lean();

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found!" });
    }

    // 2️⃣ Store in cache
    await ProductCache.findOneAndUpdate(
      { key: CACHE_KEY },
      { data: product, updatedAt: new Date() },
      { upsert: true }
    );

    console.log("✅ Product details cached");

    res.status(200).json({ success: true, data: product });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Some error occurred" });
  }
};


// @desc    Add a new product (for admin)
// @route   POST /api/admin/products/add
// @access  Admin
export const addProduct = async (req, res) => {
  try {
    const { title, description, brandId, categoryId, price, salePrice, totalStock, image } = req.body;

    const sanitizedPrice = Number(String(price).replace(/,/g, '').trim());
    const sanitizedSalePrice = Number(String(salePrice || 0).replace(/,/g, '').trim());
    const sanitizedTotalStock = Number(String(totalStock).replace(/,/g, '').trim());

    if (isNaN(sanitizedPrice) || isNaN(sanitizedTotalStock)) {
      return res.status(400).json({
        success: false,
        message: "Price and Total Stock must be valid numbers.",
      });
    }

    const newProduct = new Product({
      title,
      description,
      brandId,
      categoryId,
      image,
      price: sanitizedPrice,
      salePrice: sanitizedSalePrice,
      totalStock: sanitizedTotalStock,
    });

    const savedProduct = await newProduct.save();

    res.status(201).json({
      success: true,
      message: "Product added successfully!",
      data: savedProduct,
    });
  } catch (error) {
    console.warn(error);
    res.status(500).json({
      success: false,
      message: "Failed to add product. Please check the error details.",
      error: error.message,
    });
  }
};

