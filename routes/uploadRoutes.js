const express = require('express');
const multer = require('multer');
const { uploadProductImage } = require('../controllers/uploadController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

// Configure multer for in-memory storage. This is efficient for small files.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Define the upload route
// This route is protected and only accessible by admins.
// upload.single('my_file') is the middleware that processes the file.
// The key 'my_file' MUST match the key used in the FormData on your frontend.
router.post(
  '/admin/products/upload-image',
  protect,
  admin,
  upload.single('my_file'),
  uploadProductImage
);

module.exports = router;
