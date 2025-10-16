import cloudinary from "../helpers/cloudinary.js";

// This single function will handle all multi-image uploads.
export const handleMultipleImageUploads = async (req, res) => {
  try {
    // 'req.files' will be an array of files provided by multer.
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files were uploaded." });
    }

    // Create an array of upload promises.
    const uploadPromises = req.files.map((file) =>
      cloudinary.uploader.upload(file.path, {
        folder: "mern-ecom", // A dedicated folder in Cloudinary for product images.
      })
    );

    // Wait for all image uploads to complete.
    const results = await Promise.all(uploadPromises);
    
    // Extract the secure URLs from the results.
    const imageUrls = results.map((result) => result.secure_url);

    // Send back the array of URLs to the frontend.
    res.status(200).json({
      success: true,
      message: "Images uploaded successfully.",
      data: imageUrls,
    });
  } catch (error) {
    console.error("Multi-image upload error:", error);
    res.status(500).json({ success: false, message: "Image upload failed." });
  }
};
