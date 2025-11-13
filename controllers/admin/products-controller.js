import Product from "../../models/Product.js";


// ADD product
// ADD product
// ADD a new product
export const addProduct = async (req, res) => {
  try {
    const {
      images, // ✅ Expect an array of image URLs
      title,
      description,
      categoryId,
      brandId,
      price,
      salePrice,
      totalStock,
      isOnSale,
    } = req.body;

    // Validate that at least one image URL has been provided
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required.",
      });
    }

    const newProduct = new Product({
      images, // Save the array of images
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

    // CLEAR PRODUCT CACHE whenever admin adds product
await ProductCache.deleteMany({ key: /products:/ });
console.log("🧹 Cleared product cache due to product update");

    res.status(201).json({ success: true, message: "Product added successfully.", data: newProduct });
  } catch (e) {
    console.error("Add product error:", e);
    res.status(500).json({ success: false, message: "Error occurred while adding product." });
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



// EDIT an existing product
export const editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate that at least one image URL is present in the update
    if (!updateData.images || !Array.isArray(updateData.images) || updateData.images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required.",
      });
    }

    // Handle the logic for toggling 'On Sale' status
    if (updateData.isOnSale === false) {
      updateData.salePrice = 0;
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
// CLEAR PRODUCT CACHE whenever admin adds product
await ProductCache.deleteMany({ key: /products:/ });
console.log("🧹 Cleared product cache due to product update");

    res.status(200).json({ success: true, message: "Product updated successfully.", data: product });
  } catch (e) {
    console.error("Edit product error:", e);
    res.status(500).json({ success: false, message: "Error occurred while editing product." });
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


