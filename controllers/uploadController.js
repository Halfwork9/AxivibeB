import { v2 as cloudinary } from "cloudinary";

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "mern-ecommerce",
    });

    return res.status(200).json({
      success: true,
      message: "Image uploaded successfully!",
      result: {
        secure_url: result.secure_url,
        public_id: result.public_id,
      },
    });
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during image upload.",
      error: error.message,
    });
  }
};
