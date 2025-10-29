import express from "express";
import axios from "axios";

const router = express.Router();

/**
 * Proxy Cloudinary images safely to bypass CORS/COEP blocking
 * Example: /api/image-proxy?url=<encoded_cloudinary_url>
 */
router.get("/", async (req, res) => {
  try {
    const imageUrl = req.query.url;

    // Validate Cloudinary URLs
    if (!imageUrl || !imageUrl.startsWith("https://res.cloudinary.com/")) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing Cloudinary URL",
      });
    }

    // Fetch binary image data
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });

    // ✅ Set headers to fix Chrome COEP/CORP blocking
    res.set({
      "Content-Type": response.headers["content-type"] || "image/jpeg",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
      "Cache-Control": "public, max-age=31536000",
    });

    res.send(response.data);
  } catch (err) {
    console.error("Image proxy error:", err.message);
    res.status(500).json({ success: false, message: "Failed to load image" });
  }
});

export default router;
