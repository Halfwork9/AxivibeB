import express from "express";
import multer from "multer";
import {
  createBrand,
  deleteBrand,
  getAllBrands,
  editBrand, // Ensure editBrand is imported
} from "../../controllers/admin/brand-controller.js";
import { authMiddleware, adminMiddleware } from "../../middleware/authMiddleware.js";

const router = express.Router();

// Multer setup for temporary file storage
const storage = multer.diskStorage({});
const upload = multer({ storage });

// --- Brand Routes ---

// GET all brands (Public)
router.get("/", getAllBrands);

// POST a new brand (Admin only)
router.post("/", authMiddleware, adminMiddleware, upload.single("logo"), createBrand);

// DELETE a brand (Admin only)
router.delete("/:id", authMiddleware, adminMiddleware, deleteBrand);

// ✅ FIX: The PUT route now includes `upload.single("logo")` to handle file uploads
// PUT (edit) a brand (Admin only)
router.put("/:id", authMiddleware, adminMiddleware, upload.single("logo"), editBrand);


export default router;

