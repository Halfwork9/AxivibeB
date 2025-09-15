import express from "express";
import DistributorApplication from "../models/DistributorApplication.js";
import { authMiddleware } from "../controllers/auth/auth-controller.js";
import { Parser } from "json2csv";

const router = express.Router();

// --- POST new distributor application
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized user!" });
    }

    // check existing
    const existingApp = await DistributorApplication.findOne({ userId: req.user.id });
    if (existingApp) {
      return res.status(400).json({
        success: false,
        message: "You have already applied. Please check your status in Account → Distributor Status.",
      });
    }

    const { company, contactName, title, phone, markets } = req.body;

    const newApp = await DistributorApplication.create({
      userId: req.user.id,
      email: req.user.email, // always from auth
      company,
      contactName,
      title,
      phone,
      markets,
      status: "Submitted",
    });

    res.status(201).json({ success: true, data: newApp });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- GET current user's application
router.get("/status", authMiddleware, async (req, res) => {
  try {
    let app = await DistributorApplication.findOne({ userId: req.user.id });

    if (!app) {
      app = await DistributorApplication.findOne({ email: req.user.email });
      if (app) {
        app.userId = req.user.id;
        if (!app.email) app.email = req.user.email;
        await app.save();
      }
    }

    if (!app) {
      return res.status(404).json({ success: false, message: "No application found" });
    }

    res.json({ success: true, data: app });
  } catch (err) {
    console.error("Status check error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- GET all distributors (admin)
router.get("/", async (req, res) => {
  try {
    const apps = await DistributorApplication.find().sort({ createdAt: -1 });
    res.json({ success: true, data: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch distributors" });
  }
});

// --- Update status (admin)
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const distributor = await DistributorApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!distributor) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, data: distributor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Withdraw (user delete)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const app = await DistributorApplication.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!app) {
      return res.status(404).json({ success: false, message: "Application not found or not yours" });
    }

    res.json({ success: true, message: "Application withdrawn successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Export all applications as CSV (admin)
router.get("/export/csv", async (req, res) => {
  try {
    const apps = await DistributorApplication.find().lean();
    const fields = ["company", "contactName", "title", "email", "phone", "markets", "status", "createdAt"];
    const parser = new Parser({ fields });
    const csv = parser.parse(apps);

    res.header("Content-Type", "text/csv");
    res.attachment("distributors.csv");
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to export CSV" });
  }
});

// --- Admin delete any application
// DELETE /api/distributors/admin/:id (admin only)
router.delete("/admin/:id", authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden - Admins only" });
    }

    const distributor = await DistributorApplication.findByIdAndDelete(req.params.id);

    if (!distributor) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    res.json({ success: true, message: "Distributor application deleted successfully" });
  } catch (err) {
    console.error("Admin delete error:", err);
    res.status(500).json({ success: false, message: "Failed to delete application" });
  }
});


// ✅ Export at the very end
export default router;



