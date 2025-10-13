import express from "express";
import multer from "multer";
import { createBrand, deleteBrand, getAllBrands } from "../../controllers/admin/brand-controller.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Field name MUST be "logo"
router.post("/", upload.single("logo"), createBrand);
router.get("/", getAllBrands);
router.delete("/:id", deleteBrand);

export default router;
