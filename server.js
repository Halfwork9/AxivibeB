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
import commonFeatureRouter from "./routes/common/feature-routes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import categoryRoutes from "./routes/admin/category-routes.js";
import distributorRoutes from "./routes/distributor-routes.js";
import helmet from "helmet";

const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Add a specific route to serve images with proper CORS headers
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}, express.static('uploads'));
// Update helmet configuration
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Disable COEP
  crossOriginOpenerPolicy: false,   // Disable COOP
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:", "res.cloudinary.com"], // Allow images from any source
      scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://api.nikhilmamdekar.site"],
    },
  },
}));

// Update CORS configuration
const allowedOrigins = [
  "https://nikhilmamdekar.site",
  "https://www.nikhilmamdekar.site",
  "http://localhost:5173",
  "https://axivibe-vojm.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    // Add these options
    optionsSuccessStatus: 200,
    preflightContinue: false,
  })
);

app.options("*", cors());

// ✅ Stripe webhook must come before express.json()
app.use("/api/shop/order/webhook", bodyParser.raw({ type: "application/json" }));

app.use(cookieParser());
app.use(express.json());

// ✅ Health Check
app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend API is running 🚀" });
});
// Add this to your server.js file
app.get('/api/proxy/image', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    
    // Fetch the image
    const response = await axios.get(url, { 
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000, // Add timeout to prevent hanging
      maxRedirects: 5, // Follow redirects
    });
    
    // Set appropriate headers
    res.setHeader('Content-Type', response.headers['content-type']);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    
    // Pipe the image data to the response
    response.data.pipe(res);
  } catch (error) {
    console.error('Error proxying image:', error.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
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
app.use("/api/shop/products", shopProductsRouter);

// ✅ MongoDB connection
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));
