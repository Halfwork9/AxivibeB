import { v2 as cloudinary } from "cloudinary";

export const handleMultipleImageUploads = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files were uploaded.",
      });
    }

    const uploadPromises = req.files.map((file) =>
      cloudinary.uploader.upload(file.path, {
        folder: "mern-ecom",
      })
    );

    const results = await Promise.all(uploadPromises);
    const imageUrls = results.map((r) => r.secure_url);

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: imageUrls,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: "Image upload failed" });
  }
};
