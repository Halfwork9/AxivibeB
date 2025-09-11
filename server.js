import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import brandRoutes from "./routes/admin/brand-routes.js";
import authRouter from "./routes/auth/auth-routes.js";
import adminProductsRouter from "./routes/admin/products-routes.js";
import adminOrderRouter from "./routes/admin/order-routes.js";
import shopProductsRouter from "./routes/shop/products-routes.js";
import shopCartRouter from "./routes/shop/cart-routes.js";
import shopAddressRouter from "./routes/shop/address-routes.js";
import shopOrderRouter from "./routes/shop/order-routes.js";
import shopSearchRouter from "./routes/shop/search-routes.js";
import shopReviewRouter from "./routes/shop/review-routes.js";
import commonFeatureRouter from "./routes/common/feature-routes.js";
import imageUploadRoutes from "./routes/admin/imageUploadRoutes.js"; 
import categoryRoutes from "./routes/admin/category-routes.js";
import distributorRoutes from "./routes/distributor-routes.js";

dotenv.config();

const app = express(); // ✅ FIX: create app

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const allowedOrigins = [
  "http://localhost:5173", // dev
  "https://axivibe-vojm.vercel.app" // replace with your actual Vercel URL
]; 

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // allow cookies/auth headers
  })
);

app.use(
  cors({
    origin: "http://localhost:5173","https://axivibe-vojm.vercel.app",
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Expires",
      "Pragma",
    ],
    credentials: true,
  })
);
// Stripe requires raw body for webhook validation
// Stripe webhook needs raw body
app.use("/api/shop/order/webhook", bodyParser.raw({ type: "application/json" }));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/admin/products", adminProductsRouter);
app.use("/api/admin/orders", adminOrderRouter);
app.use("/api/admin/upload", imageUploadRoutes);
app.use("/api/shop/products", shopProductsRouter);
app.use("/api/shop/cart", shopCartRouter);
app.use("/api/shop/address", shopAddressRouter);
app.use("/api/shop/order", shopOrderRouter);
app.use("/api/shop/search", shopSearchRouter);
app.use("/api/shop/review", shopReviewRouter);
app.use("/api/common/feature", commonFeatureRouter);
app.use("/api/admin/brands", brandRoutes);
app.use("/api/admin/categories", categoryRoutes);
app.use("/api/distributors", distributorRoutes);
app.use(
  cors({
    origin: "http://localhost:5173","https://axivibe-vojm.vercel.app", // your frontend origin
    credentials: true,               // 👈 allow cookies
  })
);


app.listen(PORT, () => console.log(`Server is now running on port ${PORT}`));
