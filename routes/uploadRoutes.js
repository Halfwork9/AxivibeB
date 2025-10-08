// routes/uploadRoutes.js
import express from "express";
import { upload } from "../helpers/cloudinary.js";
import { uploadImage } from "../controllers/uploadController.js";

const router = express.Router();

// ✅ The key here must match frontend: FormData.append("my_file", file)
router.post("/upload-image", upload.single("my_file"), uploadImage);

export default router;
