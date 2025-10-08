// controllers/uploadController.js
import { cloudinary } from "../helpers/cloudinary.js";

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded.",
      });
    }

    // Convert the file buffer to a base64 string
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    // Upload directly from memory to Cloudinary
    const result = await cloudinary.v2.uploader.upload(fileBase64, {
      folder: "mern-ecom",
    });

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully!",
      result: {
        secure_url: result.secure_url,
        public_id: result.public_id,
      },
    });
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during image upload.",
      error: error.message,
    });
  }
};
