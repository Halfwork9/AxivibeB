// server.js
import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import helmet from "helmet";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import history from "connect-history-api-fallback";
import fixOrders from "./scripts/fixOrderBrandCategory.js";
// --- Routes ---
import brandRoutes from "./routes/admin/brand-routes.js";
import authRouter from "./routes/auth/auth-routes.js";
import adminProductsRouter from "./routes/admin/products-routes.js";
import adminOrderRouter from "./routes/admin/order-routes.js";
import shopProductsRouter from "./routes/shop/products-routes.js";
import shopCartRouter from "./routes/shop/cart-routes.js";
import shopAddressRouter from "./routes/shop/address-routes.js";
import shopOrderRouter from "./routes/shop/order-routes.js";
import shopSearchRouter from "./routes/shop/search-routes.js";
import commonFeatureRouter from "./routes/common/feature-routes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import categoryRoutes from "./routes/admin/category-routes.js";
import distributorRoutes from "./routes/distributor-routes.js";

// --- Config ---
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: [
      "https://nikhilmamdekar.site",
      "https://www.nikhilmamdekar.site",
      "https://axivibe-vojm.vercel.app",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());


// --- Serve uploads folder with proper CORS headers ---
app.use(
  "/uploads",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  },
  express.static("uploads")
);

// --- Helmet Security Config ---
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "http:",
          "res.cloudinary.com",
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          "https://api.nikhilmamdekar.site",
          "https://nikhilmamdekar.site",
          "https://res.cloudinary.com",
        ],
      },
    },
  })
);

// --- Stripe Webhook (raw body before express.json) ---
app.use("/api/shop/order/webhook", bodyParser.raw({ type: "application/json" }));

// --- Middlewares ---
app.use(cookieParser());
app.use(express.json());

// --- Health Check ---
app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend API is running 🚀" });
});

// --- Proxy route for Cloudinary / external images ---
app.get("/api/proxy/image", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const response = await axios.get(url, {
      responseType: "stream",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0 Safari/537.36",
      },
      timeout: 10000,
      maxRedirects: 5,
    });

    res.setHeader("Content-Type", response.headers["content-type"]);
    res.setHeader("Cache-Control", "public, max-age=86400");

    response.data.pipe(res);
  } catch (error) {
    console.error("Error proxying image:", error.message);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

// --- API Routes ---
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
app.use("/api/shop/products", shopProductsRouter);

// --- Serve React App ---
// Serve static files from the React app
app.use(express.static(path.join(__dirname, "dist")));

// Handle client-side routing
app.use(
  history({
    rewrites: [
      {
        from: /^\/shop\/.*$/,
        to: function(context) {
          return context.parsedUrl.pathname;
        }
      }
    ]
  })
);

// For any other request, serve the index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});


// --- MongoDB Connection ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    try {
      // ✅ Run migration once
      await fixOrders();
      console.log("✅ Order migration completed");
    } catch (err) {
      console.log("⚠ Migration error:", err.message);
    }

    app.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch((err) => console.log("❌ DB error:", err.message));
