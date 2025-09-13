import express from "express";
import DistributorApplication from "../models/DistributorApplication.js";
import { authMiddleware } from "../controllers/auth/auth-controller.js";

const router = express.Router();

// POST /api/distributors
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized user!" });
    }

    // check if this user already has an application
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
      email: req.user.email, // always taken from logged-in user
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

// Get current user's application
router.get("/status", authMiddleware, async (req, res) => {
  try {
    let app = await DistributorApplication.findOne({ userId: req.user.id });

    if (!app) {
      // fallback by email if userId missing
      app = await DistributorApplication.findOne({ email: req.user.email });

      // if found, backfill userId for consistency
      if (app) {
        app.userId = req.user.id;
        if (!app.email) app.email = req.user.email; // ensure email is stored
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




// GET all applications (admin use)
// GET all distributors
router.get("/", async (req, res) => {
  try {
    const apps = await DistributorApplication.find().sort({ createdAt: -1 });
    res.json({ success: true, data: apps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch distributors" });
  }
});

// ✅ Update status
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


export default router;


// --- Withdraw (user can delete only if pending/submitted)
// DELETE /api/distributors/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Only allow users to withdraw their own application
    const app = await DistributorApplication.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!app) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found or not yours" });
    }
console.log("DELETE req.user:", req.user);
console.log("DELETE req.params.id:", req.params.id);

    res.json({ success: true, message: "Application withdrawn successfully" });
  } catch (err) {
    console.error("Withdraw error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});



// --- Export all applications as CSV (admin)
import { Parser } from "json2csv";
router.get("/export/csv", async (req, res) => {
  try {
    const apps = await DistributorApplication.find().lean();

    const fields = [
      "company",
      "contactName",
      "title",
      "email",
      "phone",
      "markets",
      "status",
      "createdAt",
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(apps);

    res.header("Content-Type", "text/csv");
    res.attachment("distributors.csv");
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to export CSV" });
  }
});


// DELETE /api/distributors/admin/:id (admin only)
router.delete("/admin/:id", async (req, res) => {
  try {
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

