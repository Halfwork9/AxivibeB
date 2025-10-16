import express from "express";
import multer from "multer";
import { handleMultipleImageUploads } from "../controllers/uploadController.js";

const router = express.Router();

// Multer setup for temporary file storage
const storage = multer.diskStorage({});
const upload = multer({ storage });

// ✅ FIX: This route now correctly listens for POST requests to /upload-images
// It accepts up to 5 files with the field name "images".
router.post(
  "/upload-images",
  upload.array("images", 5),
  handleMultipleImageUploads
);

export default router;

