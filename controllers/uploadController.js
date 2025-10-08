const cloudinary = require("../config/cloudinary");

const uploadImage = async (req, res) => {
  try {
    // req.file is created by multer. If it's not here, the upload failed.
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    // The file is uploaded to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "mern-ecommerce", // Optional: specify a folder in Cloudinary
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

module.exports = { uploadImage };

