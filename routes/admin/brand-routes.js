import express from "express";
import multer from "multer";
import {
  createBrand,
  deleteBrand,
  getAllBrands,
  editBrand, // ✅ IMPORT EDITBRAND
} from "../../controllers/admin/brand-controller.js";

const router = express.Router();

const storage = multer.diskStorage({});
const upload = multer({ storage });

// Routes
router.post("/", upload.single("logo"), createBrand);
router.get("/", getAllBrands);
router.delete("/:id", deleteBrand);
router.put("/:id", upload.single("logo"), editBrand); // ✅ ADD PUT ROUTE FOR EDITING

export default router;
