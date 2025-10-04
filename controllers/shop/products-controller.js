// products-controller.js

import Product from "../../models/Product.js";

export const getFilteredProducts = async (req, res) => {
  try {
    const { category = [], brand = [], sortBy = "price-lowtohigh" } = req.query;

    let filters = {};
    // FIX: Use 'categoryId' and 'brandId' to match the Mongoose schema
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
        sort.price = 1;
        break;
    }

    const products = await Product.find(filters)
      .populate("categoryId", "name") // Populates the category name
      .populate("brandId", "name")   // Populates the brand name
      .sort(sort);
      
    res.status(200).json({ success: true, data: products });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Some error occurred" });
  }
};

// Also ensure getProductDetails is populated
export const getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate("categoryId", "name")
      .populate("brandId", "name");

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found!" });
    }

    res.status(200).json({ success: true, data: product });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Some error occurred" });
  }
};

export const addProduct = async (req, res) => {
  try {
    // Destructure all fields from the request body
    const { title, description, brandId, categoryId, price, salePrice, totalStock, image } = req.body;

    // --- START: FIX ---
    // Sanitize numeric inputs: remove commas and trim whitespace
    const sanitizedPrice = Number(String(price).replace(/,/g, '').trim());
    const sanitizedSalePrice = Number(String(salePrice || 0).replace(/,/g, '').trim());
    const sanitizedTotalStock = Number(String(totalStock).replace(/,/g, '').trim());

    // Check if the conversion resulted in a valid number
    if (isNaN(sanitizedPrice) || isNaN(sanitizedTotalStock)) {
        return res.status(400).json({
            success: false,
            message: "Price and Total Stock must be valid numbers."
        });
    }
    // --- END: FIX ---

    const newProduct = new Product({
      title,
      description,
      brandId,
      categoryId,
      image,
      // Use the sanitized numeric values
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
    // The console.warn you see in the error log is coming from here
    console.warn(error); 
    res.status(500).json({
      success: false,
      message: "Failed to add product. Please check the error details.",
      error: error.message
    });
  }
};
