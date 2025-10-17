import express from "express";
import multer from "multer";
import { handleMultipleImageUploads } from "../controllers/uploadController.js";

const router = express.Router();

// ✅ Multer config (in-memory or temp disk)
const storage = multer.diskStorage({});
const upload = multer({ storage });

// ✅ Route: /api/admin/upload/upload-images
router.post(
  "/upload-images",
  upload.array("images", 5),
  handleMultipleImageUploads
);

router.get("/", (req, res) => {
  res.json({ success: true, message: "Upload route active" });
});

export default router;
