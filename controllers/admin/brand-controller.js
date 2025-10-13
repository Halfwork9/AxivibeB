import Brand from "../../models/Brand.js";
import { v2 as cloudinary } from "cloudinary";

// NOTE: This configuration should ideally be in a separate config file (e.g., config/cloudinary.js)
// but is included here for completeness.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- Controller Functions ---

export const createBrand = async (req, res) => {
  try {
    const { name, icon } = req.body;
    let logoUrl = "";

    // If a logo file was uploaded, send it to Cloudinary
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "brands",
      });
      logoUrl = result.secure_url;
    }

    const brand = new Brand({ name, icon, logo: logoUrl });
    await brand.save();

    res.status(201).json({ success: true, message: "Brand created successfully", data: brand });
  } catch (error) {
    // Handle potential duplicate name error from MongoDB
    if (error.code === 11000) {
        return res.status(400).json({ success: false, message: "A brand with this name already exists." });
    }
    console.error("Brand creation error:", error);
    res.status(500).json({ success: false, message: "Server error during brand creation." });
  }
};

export const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find().sort({ name: 1 });
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ FIX: The editBrand function now correctly handles file uploads
export const editBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon } = req.body;
    const updateData = { name, icon };

    // If a new logo file is included in the request, upload it to Cloudinary
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "brands",
      });
      // Add the new logo URL to the data that will be updated
      updateData.logo = result.secure_url;
    }

    const updatedBrand = await Brand.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedBrand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    res.status(200).json({ success: true, message: "Brand updated successfully", data: updatedBrand });
  } catch (error) {
    console.error("Edit brand error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

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

