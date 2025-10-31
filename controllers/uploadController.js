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

    // FIX: The map now directly calls the async function, which returns a promise.
    // No need for `new Promise`.
    const uploadPromises = req.files.map((file) => 
      uploadWithRetry(file.path)
    );

    // Use Promise.allSettled to wait for all uploads (even if some fail)
    const results = await Promise.allSettled(uploadPromises);

    // Filter out the successful uploads and get their URLs
    const imageUrls = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value.secure_url);

    // Check if any uploads failed
    const failedUploads = results.filter(result => result.status === 'rejected').length;
    if (failedUploads > 0) {
        console.error(`${failedUploads} image(s) failed to upload.`);
    }

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: imageUrls,
    });

  } catch (error) {
    console.error("A critical server error occurred during upload:", error);
    res.status(500).json({ // FIX: Removed the extra dot
      success: false, 
      message: "Server error during upload" 
    });
  }
};

// This is a helper function. It can be in the same file or moved to a `utils` folder.
const uploadWithRetry = async (filePath, retryCount = 0) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "mern-ecommerce",
      resource_type: "auto",
    });
    return result;
  } catch (error) {
    if (retryCount < 3) {
      console.warn(`Upload failed for ${filePath}, retrying... (${retryCount + 1}/3)`);
      // Wait before retrying (e.g., 1s, 2s, 3s)
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return uploadWithRetry(filePath, retryCount + 1);
    } else {
      console.error(`Upload failed for ${filePath} after 3 retries:`, error);
      // Re-throw the error to be caught by Promise.allSettled
      throw error;
    }
  }
};
