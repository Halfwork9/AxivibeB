import cloudinary from "cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
export const upload = multer({ storage });
export { cloudinary };

export const imageUploadUtil = async (filePath) => {
  const result = await cloudinary.v2.uploader.upload(filePath, {
    folder: "mern-ecom",
  });

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
  };
};


