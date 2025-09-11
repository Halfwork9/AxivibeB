import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload route
router.post("/upload-image", async (req, res) => {
  try {
    if (!req.files || !req.files.my_file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const file = req.files.my_file;
    const result = await imageUploadUtil(file.tempFilePath);

    return res.json({
      success: true,
      result, // contains secure_url + public_id
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return res.status(500).json({ success: false, message: "Upload failed" });
  }
});


export default router;
