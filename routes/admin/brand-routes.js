import express from "express";
import multer from "multer";
import {
  createBrand,
  deleteBrand,
  getAllBrands,
} from "../../controllers/admin/brand-controller.js";

const router = express.Router();

// ✅ Multer setup for temporary file storage
const storage = multer.diskStorage({});
const upload = multer({ storage });

// ✅ Routes
router.post("/", upload.single("logo"), createBrand); // 👈 Handle image upload
router.get("/", getAllBrands);
router.delete("/:id", deleteBrand);

export default router;
