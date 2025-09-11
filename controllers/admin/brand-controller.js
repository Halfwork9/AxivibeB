import Brand from "../../models/Brand.js";

// Create a new brand
export const createBrand = async (req, res) => {
  try {
    const { name, icon } = req.body;

    const brandExists = await Brand.findOne({ name });
    if (brandExists) {
      return res
        .status(400)
        .json({ success: false, message: "Brand already exists" });
    }

    const brand = new Brand({ name, icon });
    await brand.save();

    res.status(201).json({ success: true, message: "Brand created", brand });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all brands
export const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find();
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete a brand by ID
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