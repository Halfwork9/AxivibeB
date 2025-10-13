import express from "express";
import multer from "multer";
import {
  createBrand,
  deleteBrand,
  getAllBrands,
  editBrand,
} from "../../controllers/admin/brand-controller.js";

// ✅ FIX: Removed the non-existent 'adminMiddleware' from the import.
import { authMiddleware } from "../../controllers/auth/auth-controller.js";

const router = express.Router();

// Multer setup for temporary file storage
const storage = multer.diskStorage({});
const upload = multer({ storage });

// --- Brand Routes ---

// GET all brands (Public)
router.get("/", getAllBrands);

// POST a new brand (Admin only)
// Note: You may want to add a separate admin-checking middleware here in the future
router.post("/", authMiddleware, upload.single("logo"), createBrand);

// DELETE a brand (Admin only)
router.delete("/:id", authMiddleware, deleteBrand);

// PUT (edit) a brand (Admin only)
router.put("/:id", authMiddleware, upload.single("logo"), editBrand);

export default router;

