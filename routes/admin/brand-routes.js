import express from "express";
import multer from "multer";
import {
  createBrand,
  deleteBrand,
  getAllBrands,
  editBrand,
} from "../../controllers/admin/brand-controller.js";

// ✅ FIX: Corrected the import path for the authentication middleware.
import { authMiddleware, adminMiddleware } from "../../controllers/auth/auth-controller.js";

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

// PUT (edit) a brand (Admin only)
router.put("/:id", authMiddleware, adminMiddleware, upload.single("logo"), editBrand);

export default router;

