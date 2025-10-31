import Order from "../../models/Order.js";
import mongoose from "mongoose";

// ✅ 1️⃣ Get Order Statistics
export const getOrderStats = async (req, res) => {
  try {
    console.log("Attempting to fetch order stats..."); // Debug log

    // Use a single aggregation pipeline for efficiency
    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: {
              // Only sum revenue for delivered orders
              $cond: [{ $eq: ["$orderStatus", "Delivered"] }, "$totalAmount", 0],
            },
          },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "Pending"] }, 1, 0] },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "Delivered"] }, 1, 0] },
          },
          // Add all unique userIds to a set to count distinct customers
          totalCustomers: { $addToSet: "$userId" },
        },
      },
      {
        $project: {
          _id: 0, // Exclude the _id field
          totalOrders: 1,
          totalRevenue: 1,
          pendingOrders: 1,
          deliveredOrders: 1,
          // Get the size of the unique customer set
          totalCustomers: { $size: "$totalCustomers" },
        },
      },
    ]);

    console.log("Stats aggregation successful:", stats[0]); // Debug log

    // 🔝 Top 5 Selling Products (FIXED)
    const topProducts = await Order.aggregate([
      { $unwind: "$cartItems" },
      {
        $group: {
          _id: "$cartItems.productId",
          title: { $first: "$cartItems.title" },
          image: { $first: "$cartItems.image" },
          totalQty: { $sum: "$cartItems.quantity" },
          // FIX: Convert price from string to a double/number before multiplying
          totalSales: {
            $sum: {
              $multiply: [
                "$cartItems.quantity",
                { $toDouble: "$cartItems.price" }, // <-- THIS IS THE FIX
              ],
            },
          },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
    ]);

    console.log("Top products aggregation successful:", topProducts); // Debug log

    // Combine the stats and top products into a single response
    const finalStats = {
      ...stats[0], // The aggregation returns an array with one object
      topProducts,
    };

    res.json({
      success: true,
      data: finalStats,
    });
  } catch (error) {
    console.error("❌ getOrderStats error:", error); // This log is your best friend!
    res.status(500).json({
      success: false,
      message: "Failed to fetch order stats",
      // Optional: include the error message in development for easier debugging
      // error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
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
    console.error("❌ getSalesOverview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales overview",
    });
  }
};
