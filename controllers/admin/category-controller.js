import Category from "../../models/Category.js";

// Create category
export const createCategory = async (req, res) => {
  try {
    const { name, icon } = req.body;

    const exists = await Category.findOne({ name });
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: "Category already exists" });
    }

    const category = new Category({ name, icon });
    await category.save();

    res.status(201).json({ success: true, message: "Category created", category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete a category by ID
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCategory = await Category.findByIdAndDelete(id);

        if (!deletedCategory) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        res.status(200).json({ success: true, message: "Category deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};