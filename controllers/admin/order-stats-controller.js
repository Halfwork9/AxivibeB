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
      topProducts: [],
      categorySales: [],
      lowStock: [],
    };

    // ─────────────────────────────────────
    // BASIC STATS
    // ─────────────────────────────────────
    const [orders, customers] = await Promise.all([
      Order.find({}),
      Order.distinct("userId"),
    ]);

    finalStats.totalOrders = orders.length;
    finalStats.totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    finalStats.pendingOrders = orders.filter(o => /pending/i.test(o.orderStatus)).length;
    finalStats.deliveredOrders = orders.filter(o => /delivered/i.test(o.orderStatus)).length;
    finalStats.totalCustomers = customers.length;

    // ─────────────────────────────────────
    // LOW STOCK
    // ─────────────────────────────────────
    finalStats.lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    // ─────────────────────────────────────
    // TOP 5 PRODUCTS (FIXED)
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
          title: { $first: { $ifNull: ["$product.title", "$cartItems.title"] } },
          image: { $first: { $arrayElemAt: ["$product.images", 0] } },
          totalQty: { $sum: "$cartItems.quantity" },
          revenue: { $sum: { $multiply: ["$cartItems.quantity", "$cartItems.price"] } },
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
    // SALES BY CATEGORY (FIXED)
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
          value: { $sum: { $multiply: ["$cartItems.quantity", "$cartItems.price"] } },
        },
      },
      { $sort: { value: -1 } },
    ]);

    finalStats.categorySales = categorySales
      .filter(c => c._id && c.value > 0)
      .map(c => ({ name: c._id, value: c.value }));

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
