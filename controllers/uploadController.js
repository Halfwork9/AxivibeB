const cloudinary = require('../config/cloudinary');

// @desc    Upload product image
// @route   POST /api/admin/products/upload-image
// @access  Admin
const uploadProductImage = async (req, res) => {
  try {
    // 'my_file' must match the key used in the FormData on the frontend
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    // Upload the file to Cloudinary
    // The file is available in req.file.buffer because of multer's memory storage
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'mern-ecommerce' }, // Optional: organize uploads in a folder
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully!',
      result: {
        secure_url: result.secure_url,
        public_id: result.public_id,
      },
    });
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    res.status(500).json({
      success: false,
      message: 'Image upload failed. Please try again.',
      error: error.message,
    });
  }
};

module.exports = {
  uploadProductImage,
};
