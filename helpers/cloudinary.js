import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configure the Cloudinary instance with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Export the configured instance to be used throughout your backend
export default cloudinary;
