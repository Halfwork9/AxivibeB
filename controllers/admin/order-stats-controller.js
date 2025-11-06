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
      confirmedOrders: 0,
      shippedOrders: 0,
    };

    // ─────────────────────────────────────
    // 1. BASIC COUNTS
    // ─────────────────────────────────────
    const orders = await Order.find({});
    finalStats.totalOrders = orders.length;
    finalStats.totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    finalStats.pendingOrders = orders.filter(o => /pending/i.test(o.orderStatus)).length;
    finalStats.deliveredOrders = orders.filter(o => /delivered/i.test(o.orderStatus)).length;
    finalStats.confirmedOrders = orders.filter(o => /confirmed/i.test(o.orderStatus)).length;
    finalStats.shippedOrders = orders.filter(o => /shipped/i.test(o.orderStatus)).length;
    finalStats.totalCustomers = new Set(orders.map(o => o.userId)).size;

    // ─────────────────────────────────────
    // 2. LOW STOCK
    // ─────────────────────────────────────
    finalStats.lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    // ─────────────────────────────────────
    // 3. TOP 5 PRODUCTS
    // ─────────────────────────────────────
    const topProducts = await Order.aggregate([
      { $match: { "cartItems.0": { $exists: true } } },
      { $unwind: "$cartItems" },
      { $addFields: { "cartItems.productId": { $toObjectId: "$cartItems.productId" } } },
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
          totalQty: { $sum: "$cartItems.quantity" },
          revenue: { $sum: { $multiply: ["$cartItems.quantity", "$cartItems.price"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    finalStats.topProducts = topProducts;

    // ─────────────────────────────────────
    // 4. SALES BY CATEGORY
    // ─────────────────────────────────────
    const categorySales = await Order.aggregate([
      { $match: { "cartItems.0": { $exists: true } } },
      { $unwind: "$cartItems" },
      { $addFields: { "cartItems.productId": { $toObjectId: "$cartItems.productId" } } },
      {
        $lookup: {
          from: "products",
          localField: "cartItems.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      { $addFields: { "product.categoryId": { $toObjectId: "$product.categoryId" } } },
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
      { $sort: { value: -1 } },
    ]);

    finalStats.categorySales = categorySales.filter(c => c.value > 0);

    res.json({ success: true, data: finalStats });
  } catch (error) {
    console.error("getOrderStats ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
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
