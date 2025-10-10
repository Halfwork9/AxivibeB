import express from "express";
import { addReview } from "../../controllers/shop/review-controller.js";
import { authMiddleware } from "../../controllers/auth/auth-controller.js";

const router = express.Router();

router.post("/:productId/reviews", authMiddleware, addReview);

export default router;
