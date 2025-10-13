import Brand from "../../models/Brand.js";
import { imageUploadUtil } from "../../helpers/cloudinary.js";

// ✅ Create Brand
export const createBrand = async (req, res) => {
  try {
    const { name, icon } = req.body;
    let logoUrl = "";

    // Handle file upload if exists
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const url = "data:" + req.file.mimetype + ";base64," + b64;
      const result = await imageUploadUtil(url);
      logoUrl = result?.secure_url || "";
    }

    const brandExists = await Brand.findOne({ name });
    if (brandExists) {
      return res
        .status(400)
        .json({ success: false, message: "Brand already exists" });
    }

    const brand = new Brand({ name, icon, logo: logoUrl });
    await brand.save();

    res.status(201).json({ success: true, message: "Brand created", data: brand });
  } catch (error) {
    console.error(error);
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
    let updateData = { name, icon };

    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const url = "data:" + req.file.mimetype + ";base64," + b64;
      const result = await imageUploadUtil(url);
      updateData.logo = result?.secure_url || "";
    }

    const updated = await Brand.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Brand not found" });

    res.status(200).json({ success: true, message: "Brand updated", data: updated });
  } catch (error) {
    console.error(error);
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
