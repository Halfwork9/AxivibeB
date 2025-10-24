import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";

// ✅ Route imports
import brandRoutes from "./routes/admin/brand-routes.js";
import authRouter from "./routes/auth/auth-routes.js";
import adminProductsRouter from "./routes/admin/products-routes.js";
import adminOrderRouter from "./routes/admin/order-routes.js";
import shopProductsRouter from "./routes/shop/products-routes.js"; // includes reviews
import shopCartRouter from "./routes/shop/cart-routes.js";
import shopAddressRouter from "./routes/shop/address-routes.js";
import shopOrderRouter from "./routes/shop/order-routes.js";
import shopSearchRouter from "./routes/shop/search-routes.js";
import commonFeatureRouter from "./routes/common/feature-routes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import categoryRoutes from "./routes/admin/category-routes.js";
import distributorRoutes from "./routes/distributor-routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// ✅ Allowed frontend URLs
const allowedOrigins = [
  "http://localhost:5173",
  "https://axivibe.vercel.app",
  "https://axivibe-vojm.vercel.app",
  "https://nikhilmamdekar.site",
  "https://www.nikhilmamdekar.site",
];

// ✅ CORS setup
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ✅ COOP/COEP setup — allows Google popup + Cloudinary images
app.use((req, res, next) => {
  // Allow Google popup to communicate
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

  // Prevent Cloudinary and other external resources from being blocked
  res.removeHeader("Cross-Origin-Embedder-Policy");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  next();
});

// ✅ Stripe webhook must come before express.json()
app.use("/api/shop/order/webhook", bodyParser.raw({ type: "application/json" }));

// ✅ General middleware
app.use(cookieParser());
app.use(express.json());

// ✅ Health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend API is running 🚀" });
});

// ✅ API Routes
app.use("/api/auth", authRouter);
app.use("/api/admin/products", adminProductsRouter);
app.use("/api/admin/orders", adminOrderRouter);
app.use("/api/admin/upload", uploadRoutes);
app.use("/api/shop/cart", shopCartRouter);
app.use("/api/shop/address", shopAddressRouter);
app.use("/api/shop/order", shopOrderRouter);
app.use("/api/shop/search", shopSearchRouter);
app.use("/api/common/feature", commonFeatureRouter);
app.use("/api/admin/brands", brandRoutes);
app.use("/api/admin/categories", categoryRoutes);
app.use("/api/distributors", distributorRoutes);
app.use("/api/shop/products", shopProductsRouter); // Handles both products + reviews

// ✅ Connect to MongoDB and start server
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));
