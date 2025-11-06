// src/controllers/admin/order-stats-controller.js
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";

// Get Order Statistics
export const getOrderStats = async (req, res) => {
  try {
    console.log("=== Starting getOrderStats ===");

    // ──────────────────────────────────────────────────────────────
    // 1. BASIC COUNTS (Real, no random)
    // ──────────────────────────────────────────────────────────────
    const [totalOrders, pendingOrders, deliveredOrders, confirmedOrders, shippedOrders, customers] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: /pending/i }),
      Order.countDocuments({ orderStatus: /delivered/i }),
      Order.countDocuments({ orderStatus: /confirmed/i }),
      Order.countDocuments({ orderStatus: /shipped/i }),
      Order.distinct("userId"),
    ]);

    const totalRevenueAgg = await Order.aggregate([
      { $match: { paymentStatus: /paid/i } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const totalRevenue = totalRevenueAgg[0]?.total || 0;

    // ──────────────────────────────────────────────────────────────
    // 2. LOW STOCK (Real)
    // ──────────────────────────────────────────────────────────────
    const lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    // ──────────────────────────────────────────────────────────────
    // 3. TOP 5 PRODUCTS (Real Data)
    // ──────────────────────────────────────────────────────────────
    let topProducts = [];
    try {
      topProducts = await Order.aggregate([
        { $match: { "cartItems.0": { $exists: true } } },
        { $unwind: "$cartItems" },
        {
          $lookup: {
            from: "products",
            localField: "cartItems.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$cartItems.productId",
            title: { $first: { $ifNull: ["$product.title", "$cartItems.title"] } },
            image: { $first: { $arrayElemAt: ["$product.images", 0] } },
            totalQty: { $sum: "$cartItems.quantity" },
            revenue: { $sum: { $multiply: ["$cartItems.quantity", "$cartItems.price"] } },
          },
        },
        { $match: { revenue: { $gt: 0 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]);
    } catch (err) {
      console.error("Top products error:", err);
    }

    // ──────────────────────────────────────────────────────────────
    // 4. SALES BY CATEGORY (Real Data)
    // ──────────────────────────────────────────────────────────────
    let categorySales = [];
    try {
      categorySales = await Order.aggregate([
        { $match: { "cartItems.0": { $exists: true } } },
        { $unwind: "$cartItems" },
        {
          $lookup: {
            from: "products",
            localField: "cartItems.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "categories",
            localField: "product.categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$category.name", "Uncategorized"] },
            value: { $sum: { $multiply: ["$cartItems.quantity", "$cartItems.price"] } },
          },
        },
        { $match: { value: { $gt: 0 } } },
        { $sort: { value: -1 } },
        { $limit: 10 },
      ]);
    } catch (err) {
      console.error("Category sales error:", err);
    }

    // ──────────────────────────────────────────────────────────────
    // Response
    // ──────────────────────────────────────────────────────────────
    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        pendingOrders,
        deliveredOrders,
        totalCustomers,
        topProducts,
        categorySales,
        lowStock,
        confirmedOrders,
        shippedOrders,
      },
    });
  } catch (error) {
    console.error("getOrderStats ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch order stats" });
  }
};
// Get Sales Overview
export const getSalesOverview = async (req, res) => {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const raw = await Order.aggregate([
      {
        $match: {
          $or: [{ orderDate: { $gte: last30Days } }, { createdAt: { $gte: last30Days } }],
        },
      },
      {
        $group: {
          _id: {
            year: { $year: { $ifNull: ["$orderDate", "$createdAt"] } },
            month: { $month: { $ifNull: ["$orderDate", "$createdAt"] } },
            day: { $dayOfMonth: { $ifNull: ["$orderDate", "$createdAt"] } },
          },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    const formatted = raw.map((d) => ({
      date: `${d._id.day}/${d._id.month}`,
      revenue: d.revenue,
      orders: d.orders,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("getSalesOverview ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sales overview" });
  }
};
