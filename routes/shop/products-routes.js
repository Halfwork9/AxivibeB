import {
  getAllProducts,
  getProductById,
} from "../../controllers/shop/products-controller.js";
import { addReview } from "../../controllers/shop/review-controller.js";
// ✅ FIX: Corrected the import path for the authentication middleware, as you pointed out.
import { authMiddleware } from "../../controllers/auth/auth-controller.js";

const router = express.Router();

// --- Product Fetching Routes ---

// GET /api/shop/products/get
router.get("/get", getAllProducts);

// GET /api/shop/products/product-details/:id
router.get("/product-details/:id", getProductById);


// --- Review Routes ---

// ✅ FIX: The review route is now part of the main product router.
// This correctly creates the final URL: POST /api/shop/products/:productId/reviews
router.post("/:productId/reviews", authMiddleware, addReview);


export default router;
