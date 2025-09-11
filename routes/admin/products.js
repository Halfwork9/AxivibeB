import express from "express";
import { imageUploadUtil } from "../../helpers/cloudinary.js";

const router = express.Router();

router.post("/upload-image", async (req, res) => {
  try {
    if (!req.files || !req.files.my_file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const file = req.files.my_file;
    const result = await imageUploadUtil(file.tempFilePath);

    return res.json({
      success: true,
      result: {
        url: result.secure_url, // ✅ always use secure_url
        public_id: result.public_id,
      },
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return res.status(500).json({ success: false, message: "Upload failed" });
  }
});

export default router;
