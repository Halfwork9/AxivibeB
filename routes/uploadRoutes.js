// routes/uploadRoutes.js
import express from "express";
import upload from "../middlewares/multer.js"; // the multer config
import { uploadImage } from "../controllers/uploadController.js";

const router = express.Router();

// Ensure the key matches what frontend sends
router.post("/upload-image", upload.single("my_file"), uploadImage);

export default router;
