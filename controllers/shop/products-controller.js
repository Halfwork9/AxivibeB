import Product from "../../models/Product.js";

// @desc    Fetch all filtered products
// @route   GET /api/shop/products/get
// @access  Public
export const getAllProducts = async (req, res) => {
  try {
    const { category = [], brand = [], sortBy = "price-lowtohigh" } = req.query;

    let filters = {};
    if (category.length) filters.categoryId = { $in: category.split(",") };
    if (brand.length) filters.brandId = { $in: brand.split(",") };

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
      default:
        sort.createdAt = -1; // Default to newest
        break;
    }

    const products = await Product.find(filters)
      .populate("categoryId", "name")
      .populate("brandId", "name")
      .sort(sort);

    res.status(200).json({ success: true, data: products });
  } catch (e) {
    console.error("Error in getAllProducts:", e);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc Fetch single product by ID
// @route GET /api/shop/product-details/:id
// @access Public
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(id)
      .populate("categoryId", "name")
      .populate("brandId", "name");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// @desc    Add a new product
// @route   POST /api/shop/products/add
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
            message: "Price and Total Stock must be valid numbers."
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
      data: savedProduct
    });
  } catch (error) {
    console.warn(error);
    res.status(500).json({
      success: false,
      message: "Failed to add product. Please check the error details.",
      error: error.message
    });
  }
};
