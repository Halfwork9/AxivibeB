import Order from "../../models/Order.js";
import mongoose from "mongoose";

// ✅ 1️⃣ Get Order Statistics (More Robust Version)
export const getOrderStats = async (req, res) => {
  try {
    console.log("🔍 [DEBUG] Attempting to fetch order stats...");

    let stats = null;
    let topProducts = [];

    // --- Try to get general stats ---
    try {
      console.log("🔍 [DEBUG] Running general stats aggregation...");
      const statsResult = await Order.aggregate([
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
      stats = statsResult[0];
      console.log("✅ [DEBUG] General stats fetched successfully:", stats);
    } catch (statsError) {
      console.error("❌ [ERROR] Failed to fetch general stats:", statsError);
    }

    // --- Try to get top products ---
    try {
      console.log("🔍 [DEBUG] Running top products aggregation...");
      // Add a $match stage to filter out documents with invalid price data
      const topProductsResult = await Order.aggregate([
        {
          $match: {
            "cartItems.price": { $exists: true, $type: "string", $ne: "" }, // Ensure price is a non-empty string
          },
        },
        { $unwind: "$cartItems" },
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
                  { $toDouble: { $ifNull: ["$cartItems.price", "0"] } }, // Safely convert to number
                ],
              },
            },
          },
        },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
      ]);
      topProducts = topProductsResult;
      console.log("✅ [DEBUG] Top products fetched successfully:", topProducts);
    } catch (productsError) {
      console.error("❌ [ERROR] Failed to fetch top products:", productsError);
    }

    // If both failed, return an error
    if (!stats && topProducts.length === 0) {
      throw new Error("Failed to fetch all dashboard data components.");
    }

    const finalStats = {
      totalOrders: stats?.totalOrders || 0,
      totalRevenue: stats?.totalRevenue || 0,
      pendingOrders: stats?.pendingOrders || 0,
      deliveredOrders: stats?.deliveredOrders || 0,
      totalCustomers: stats?.totalCustomers || 0,
      topProducts,
    };

    console.log("✅ [DEBUG] Final stats compiled:", finalStats);
    res.json({
      success: true,
      data: finalStats,
    });
  } catch (error) {
    // This is the most important log for you to find!
    console.error("❌ [CRITICAL ERROR] in getOrderStats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order stats",
    });
  }
};

// ✅ 2️⃣ Get Sales Overview for Recharts
export const getSalesOverview = async (req, res) => {
  try {
    console.log("🔍 [DEBUG] Attempting to fetch sales overview...");
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

    console.log("✅ [DEBUG] Sales overview fetched:", formatted);
    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("❌ [CRITICAL ERROR] in getSalesOverview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales overview",
    });
  }
};
