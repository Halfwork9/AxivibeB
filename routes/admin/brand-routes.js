import express from "express";
import multer from "multer";
import {
  createBrand,
  deleteBrand,
  getAllBrands,
  editBrand,
} from "../../controllers/admin/brand-controller.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", upload.single("logo"), createBrand);
router.get("/", getAllBrands);
router.put("/:id", upload.single("logo"), editBrand);
router.delete("/:id", deleteBrand);

export default router;
