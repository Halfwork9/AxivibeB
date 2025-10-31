// controllers/upload-controller.js
import { v2 as cloudinary } from "cloudinary";

export const handleMultipleImageUploads = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files were uploaded.",
      });
    }

    const uploadPromises = req.files.map((file, index) => {
      return new Promise((resolve, reject) => {
        // Add retry logic for each file upload
        const uploadWithRetry = async (file, retryCount = 0) => {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: "mern-ecommerce",
              resource_type: "auto",
              timeout: 30000, // Increased timeout
            });
            
            return { secure_url: result.secure_url };
          } catch (error) {
            if (retryCount < 3) {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
              return uploadWithRetry(file, retryCount + 1);
            } else {
              throw error;
            }
          }
        });
      });
    });

    try {
      const results = await Promise.allSettled(uploadPromises);
      const imageUrls = results.map(result => result.secure_url);
      
      res.status(200).json({
        success: true,
        message: "Images uploaded successfully",
        data: imageUrls,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Image upload failed. Please try again." 
      });
    }
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500). json({ 
      success: false, 
      message: "Server error during upload" 
    });
  }
};
