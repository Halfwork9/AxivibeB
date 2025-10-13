import Brand from "../../models/Brand.js";
import { v2 as cloudinary } from "cloudinary";

// Ensure Cloudinary is configured (it should be in a separate config file, but here for completeness)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create Brand
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

    const brandExists = await Brand.findOne({ name });
    if (brandExists) {
      return res
        .status(400)
        .json({ success: false, message: "Brand already exists" });
    }

    const brand = new Brand({
      name,
      icon,
      logo: logoUrl,
    });

    await brand.save();
    res.status(201).json({ success: true, message: "Brand created", data: brand });
  } catch (error) {
    console.error("Brand creation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get All Brands
export const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find();
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ✅ EDIT BRAND (Updated)
export const editBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon } = req.body;
    const updateData = { name, icon };

    // If a new logo is uploaded, upload it to Cloudinary
    if (req.file) {
       const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "brands",
      });
      updateData.logo = result.secure_url;
    }

    const updatedBrand = await Brand.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedBrand)
      return res.status(404).json({ success: false, message: "Brand not found" });

    res.status(200).json({ success: true, message: "Brand updated", data: updatedBrand });
  } catch (error) {
    console.error("Edit brand error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete Brand
export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBrand = await Brand.findByIdAndDelete(id);

    if (!deletedBrand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    res.status(200).json({ success: true, message: "Brand deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
