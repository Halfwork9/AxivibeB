import express from "express";
import { upload } from "../helpers/cloudinary.js";
import { uploadImage } from "../controllers/uploadController.js";

const router = express.Router();

router.post("/upload-image", upload.single("image"), uploadImage);

export default router;
