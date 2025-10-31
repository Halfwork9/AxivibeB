// src/controllers/admin/order-stats-controller.js

import Order from "../../models/Order.js";
import mongoose from "mongoose";

// ✅ 1️⃣ Get Order Statistics (Robust Version)
export const getOrderStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month

    let revenueGrowthPercentage = 0;

    // --- Safely calculate revenue growth ---
    try {
      const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
        Order.aggregate([
          { $match: { orderDate: { $gte: startOfCurrentMonth }, orderStatus: "Delivered" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Order.aggregate([
          { $match: { orderDate: { $gte: startOfLastMonth, $lte: endOfLastMonth }, orderStatus: "Delivered" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
      ]);

      const current = currentMonthRevenue[0]?.total || 0;
      const last = lastMonthRevenue[0]?.total || 0;

      if (last > 0) {
        revenueGrowthPercentage = ((current - last) / last) * 100;
      }
      console.log("✅ Revenue growth calculated successfully.");
    } catch (growthError) {
      console.error("❌ Could not calculate revenue growth, defaulting to 0:", growthError.message);
      // The variable remains 0, which is a safe default
    }

    // --- Get general stats ---
    const statsAgg = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ["$orderStatus", "Delivered"] }, "$totalAmount", 0],
            },
          },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "Pending"] }, 1, 0] },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "Delivered"] }, 1, 0] },
          },
          totalCustomers: { $addToSet: "$userId" },
        },
      },
      {
        $project: {
          _id: 0,
          totalOrders: 1,
          totalRevenue: 1,
          pendingOrders: 1,
          deliveredOrders: 1,
          totalCustomers: { $size: "$totalCustomers" },
        },
      },
    ]);

    // --- Get top products (robust version) ---
    const topProducts = await Order.aggregate([
      { $unwind: "$cartItems" },
      {
        $addFields: {
          cleanPrice: {
            $replaceAll: {
              input: { $replaceAll: { input: "$cartItems.price", find: "$", replacement: "" } },
              find: "₹",
              replacement: "",
            },
          },
        },
      },
      {
        $group: {
          _id: "$cartItems.productId",
          title: { $first: "$cartItems.title" },
          image: { $first: "$cartItems.image" },
          totalQty: { $sum: "$cartItems.quantity" },
          totalSales: {
            $sum: {
              $multiply: [
                "$cartItems.quantity",
                { $cond: { if: { $ne: ["$cleanPrice", ""] }, then: { $toDouble: "$cleanPrice" }, else: 0 } },
              ],
            },
          },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
    ]);

    const finalStats = {
      ...statsAgg[0],
      revenueGrowthPercentage: revenueGrowthPercentage.toFixed(2),
      topProducts,
    };

    res.json({ success: true, data: finalStats });
  } catch (error) {
    console.error("❌ [CRITICAL ERROR] in getOrderStats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch order stats" });
  }
};

// ✅ 2️⃣ Get Sales Overview for Recharts
export const getSalesOverview = async (req, res) => {
  try {
    const today = new Date();
    const last30Days = new Date();
    last30Days.setDate(today.getDate() - 30);

    const data = await Order.aggregate([
      { $match: { orderDate: { $gte: last30Days } } },
      {
        $group: {
          _id: {
            year: { $year: "$orderDate" },
            month: { $month: "$orderDate" },
            day: { $dayOfMonth: "$orderDate" },
          },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    const formatted = data.map((d) => ({
      date: `${d._id.day}/${d._id.month}`,
      revenue: d.revenue,
      orders: d.orders,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("❌ [CRITICAL ERROR] in getSalesOverview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales overview",
    });
  }
};
