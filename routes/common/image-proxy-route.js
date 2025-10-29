import express from "express";
import axios from "axios";

const router = express.Router();

/**
 * @route GET /api/image-proxy
 * @query url=<cloudinary_url>
 * Example: /api/image-proxy?url=https://res.cloudinary.com/daxujngz2/image/upload/v1759988038/mern-ecommerce/mxivz1zc7rae2aztirrg.avif
 */
router.get("/", async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl || !imageUrl.startsWith("https://res.cloudinary.com/")) {
      return res.status(400).json({ success: false, message: "Invalid image URL" });
    }

    // Fetch image as binary
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });

    // Pass through Cloudinary content-type header
    res.set("Content-Type", response.headers["content-type"] || "image/jpeg");
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("Cache-Control", "public, max-age=31536000");
    res.send(response.data);
  } catch (error) {
    console.error("Image proxy error:", error.message);
    res.status(500).json({ success: false, message: "Image proxy error" });
  }
});

export default router;
