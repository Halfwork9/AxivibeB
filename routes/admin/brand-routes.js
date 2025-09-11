import express from "express";
import { createBrand, deleteBrand, getAllBrands } from "../../controllers/admin/brand-controller.js";

const router = express.Router();

router.post("/", createBrand);
router.get("/", getAllBrands);
router.delete("/:id", deleteBrand);

export default router;
