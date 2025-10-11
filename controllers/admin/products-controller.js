import Product from "../../models/Product.js";
import { imageUploadUtil } from "../../helpers/cloudinary.js";

// Upload image
export const handleImageUpload = async (req, res) => {
  try {
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const url = "data:" + req.file.mimetype + ";base64," + b64;
    const result = await imageUploadUtil(url);

    res.json({ success: true, result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};

// ADD product
// ADD product
export const addProduct = async (req, res) => {
  try {
    const {
      image,
      title,
      description,
      categoryId,
      brandId,
      price,
      salePrice,
      totalStock,
      averageReview,
      isOnSale, // ✅ added
    } = req.body;

    const newProduct = new Product({
      image,
      title,
      description,
      categoryId,
      brandId,
      price,
      salePrice: isOnSale ? salePrice : 0, // ✅ apply only if true
      isOnSale: Boolean(isOnSale),
      totalStock,
      averageReview,
    });

    await newProduct.save();
    res.status(201).json({ success: true, data: newProduct });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};

// FETCH all products
export const fetchAllProducts = async (req, res) => {
  try {
    const { categoryId, brandId, isOnSale, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (categoryId) filter.categoryId = categoryId;
    if (brandId) filter.brandId = brandId;
    if (isOnSale !== undefined) filter.isOnSale = isOnSale === "true";

    const products = await Product.find(filter)
      .populate("categoryId", "name")
      .populate("brandId", "name")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};

// GET product details
export const getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate("categoryId", "name")
      .populate("brandId", "name");

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found!" });
    }

    res.status(200).json({ success: true, data: product });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Some error occurred" });
  }
};



// EDIT product
export const editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // ✅ Handle sale toggle logic
    if (!updateData.isOnSale) {
      updateData.salePrice = 0;
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("categoryId", "name")
      .populate("brandId", "name");

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, data: product });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};
// DELETE product
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};


