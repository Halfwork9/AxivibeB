import express from "express";
import { upload } from "../helpers/cloudinary.js";
import { uploadImage } from "../controllers/uploadController.js";

const router = express.Router();

// ✅ key must match frontend: "file"
router.post("/upload-image", upload.single("file"), uploadImage);

export default router;
