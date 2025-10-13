import Brand from "../../models/Brand.js";
import { imageUploadUtil } from "../../helpers/cloudinary.js";

// ✅ Create Brand
export const createBrand = async (req, res) => {
  try {
    const { name, icon } = req.body;
    let logoUrl = "";

    // ✅ upload logo if file exists
    if (req.file) {
      const base64Image = Buffer.from(req.file.buffer).toString("base64");
      const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
      const uploadResponse = await imageUploadUtil(imageData);
      logoUrl = uploadResponse?.secure_url || "";
    }

    const existing = await Brand.findOne({ name });
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "Brand already exists" });

    const brand = new Brand({ name, icon, logo: logoUrl });
    await brand.save();

    res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: brand, // ✅ returning full brand with logo
    });
  } catch (error) {
    console.error("Create brand error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// ✅ Get All Brands
export const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find();
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Edit Brand
export const editBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon } = req.body;
    const updateData = { name, icon };

    // ✅ upload logo if new one provided
    if (req.file) {
      const base64Image = Buffer.from(req.file.buffer).toString("base64");
      const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
      const uploadResponse = await imageUploadUtil(imageData);
      updateData.logo = uploadResponse?.secure_url || "";
    }

    const updatedBrand = await Brand.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedBrand)
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });

    res
      .status(200)
      .json({ success: true, message: "Brand updated", data: updatedBrand });
  } catch (error) {
    console.error("Edit brand error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Delete Brand
export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBrand = await Brand.findByIdAndDelete(id);

    if (!deletedBrand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    res.status(200).json({ success: true, message: "Brand deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

