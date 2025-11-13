import express from "express";
import {
  addProduct,
  editProduct,
  fetchAllProducts,
  deleteProduct,
} from "../../controllers/admin/products-controller.js";
import ProductCache from "../../models/ProductCache.js";

const router = express.Router();

// ✅ No image upload handled here anymore — handled separately in /api/admin/upload
router.post("/add", addProduct);
router.put("/edit/:id", editProduct);
router.delete("/delete/:id", deleteProduct);
router.get("/get", fetchAllProducts);
router.delete("/clear-cache", async (req, res) => {
  await ProductCache.deleteMany({});
  res.json({ success: true, message: "Product cache cleared" });
});

export default router;
