import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";

// Route imports - using only the correct ESM 'import' syntax
import brandRoutes from "./routes/admin/brand-routes.js";
import authRouter from "./routes/auth/auth-routes.js";
import adminProductsRouter from "./routes/admin/products-routes.js";
import adminOrderRouter from "./routes/admin/order-routes.js";
import shopProductsRouter from "./routes/shop/products-routes.js";
import shopCartRouter from "./routes/shop/cart-routes.js";
import shopAddressRouter from "./routes/shop/address-routes.js";
import shopOrderRouter from "./routes/shop/order-routes.js";
import shopSearchRouter from "./routes/shop/search-routes.js";
import reviewRoutes from "./routes/shop/reviewRoutes.js"; // Corrected import
import commonFeatureRouter from "./routes/common/feature-routes.js";
import uploadRoutes from "./routes/uploadRoutes.js"; // Corrected import
import categoryRoutes from "./routes/admin/category-routes.js";
import distributorRoutes from "./routes/distributor-routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// ✅ CORS whitelist
const allowedOrigins = [
  "http://localhost:5173",
  "https://axivibe.vercel.app",
  "https://axivibe-vojm.vercel.app",
  "https://axivibe1.onrender.com",
];

// ✅ FIX: Simplified and more robust CORS middleware configuration
const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Enable pre-flight for all routes

// Stripe webhook (must be before express.json())
app.use("/api/shop/order/webhook", bodyParser.raw({ type: "application/json" }));

app.use(cookieParser());
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend API is running 🚀" });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/admin/products", adminProductsRouter);
app.use("/api/admin/orders", adminOrderRouter);
app.use("/api/admin/upload", uploadRoutes); // Corrected to use 'uploadRoutes'
app.use("/api/shop/products", shopProductsRouter);
app.use("/api/shop/cart", shopCartRouter);
app.use("/api/shop/address", shopAddressRouter);
app.use("/api/shop/order", shopOrderRouter);
app.use("/api/shop/search", shopSearchRouter);
app.use("/api/shop/products", reviewRoutes); // This handles review routes like /:productId/reviews
app.use("/api/common/feature", commonFeatureRouter);
app.use("/api/admin/brands", brandRoutes);
app.use("/api/admin/categories", categoryRoutes);
app.use("/api/distributors", distributorRoutes);

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Start server
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));

