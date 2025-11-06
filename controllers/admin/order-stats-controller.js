// src/controllers/admin/order-stats-controller.js
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";

export const getOrderStats = async (req, res) => {
  try {
    const finalStats = {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      deliveredOrders: 0,
      totalCustomers: 0,
      revenueGrowthPercentage: 0,
      topProducts: [],
      ordersChange: { value: 0, percentage: 0 },
      pendingChange: { value: 0, percentage: 0 },
      deliveredChange: { value: 0, percentage: 0 },
      customersChange: { value: 0, percentage: 0 },
      lowStock: [],
      confirmedOrders: 0,
      shippedOrders: 0,
      categorySales: [],
    };

    // ─────────────────────────────────────
    // 1. BASIC COUNTS
    // ─────────────────────────────────────
    const [totalOrders, pendingOrders, deliveredOrders, confirmedOrders, shippedOrders, customers] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: /pending/i }),
      Order.countDocuments({ orderStatus: /delivered/i }),
      Order.countDocuments({ orderStatus: /confirmed/i }),
      Order.countDocuments({ orderStatus: /shipped/i }),
      Order.distinct("userId"),
    ]);

    finalStats.totalOrders = totalOrders;
    finalStats.pendingOrders = pendingOrders;
    finalStats.deliveredOrders = deliveredOrders;
    finalStats.confirmedOrders = confirmedOrders;
    finalStats.shippedOrders = shippedOrders;
    finalStats.totalCustomers = customers.length;

    // ─────────────────────────────────────
    // 2. TOTAL REVENUE (Delivered + Confirmed)
    // ─────────────────────────────────────
    const revenueAgg = await Order.aggregate([
      { $match: { orderStatus: { $in: [/delivered/i, /confirmed/i] } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    finalStats.totalRevenue = revenueAgg[0]?.total || 0;

    // ─────────────────────────────────────
    // 3. LOW STOCK
    // ─────────────────────────────────────
    finalStats.lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    // ─────────────────────────────────────
    // 4. TOP 5 PRODUCTS (REAL DATA)
    // ─────────────────────────────────────
    const topProducts = await Order.aggregate([
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
          title: { $first: "$product.title" },
          image: { $first: { $arrayElemAt: ["$product.images", 0] } },
          totalQty: { $sum: "$cartItems.quantity" },
          revenue: {
            $sum: { $multiply: ["$cartItems.quantity", { $toDouble: "$cartItems.price" }] }
          },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    finalStats.topProducts = topProducts.map(p => ({
      _id: p._id,
      title: p.title || "Unknown",
      image: p.image,
      totalQty: p.totalQty,
      revenue: p.revenue,
    }));

    // ─────────────────────────────────────
    // 5. SALES BY CATEGORY (REAL DATA)
    // ─────────────────────────────────────
    const categorySales = await Order.aggregate([
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
          _id: "$category.name",
          value: {
            $sum: { $multiply: ["$cartItems.quantity", { $toDouble: "$cartItems.price" }] }
          },
        },
      },
      { $sort: { value: -1 } },
    ]);

    finalStats.categorySales = categorySales
      .filter(c => c._id && c.value > 0)
      .map(c => ({
        name: c._id,
        value: c.value,
      }));

    // ─────────────────────────────────────
    res.json({ success: true, data: finalStats });
  } catch (error) {
    console.error("getOrderStats ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
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
