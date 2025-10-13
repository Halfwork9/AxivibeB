import express from "express";
import multer from "multer";
import { createBrand, deleteBrand, getAllBrands } from "../../controllers/admin/brand-controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // ✅ Use memory upload for Cloudinary

router.post("/", upload.single("logo"), createBrand); // ✅ Handles logo upload
router.get("/", getAllBrands);
router.delete("/:id", deleteBrand);

export default router;
