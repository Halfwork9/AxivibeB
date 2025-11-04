// src/controllers/admin/order-stats-controller.js

import Order from "../../models/Order.js";

// Helper function to get date ranges
const getDateRanges = () => {
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);
  
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  return { startOfThisWeek, startOfLastWeek, startOfCurrentMonth, startOfLastMonth, endOfLastMonth };
};

// ✅ 1️⃣ Get Order Statistics (Case-Insensitive & Logic-Fixed)
export const getOrderStats = async (req, res) => {
  try {
    const { startOfThisWeek, startOfLastWeek, startOfCurrentMonth, startOfLastMonth, endOfLastMonth } = getDateRanges();

    let finalStats = {
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
    };

    // Debug: Check if orders exist and their statuses
    const allOrders = await Order.find({});
    console.log("All orders count:", allOrders.length);
    console.log("Sample order statuses:", allOrders.slice(0, 5).map(o => ({ id: o._id, status: o.orderStatus, date: o.orderDate || o.createdAt })));

    // --- 1. Total Orders & Weekly Change ---
    try {
      const [thisWeekOrders, lastWeekOrders] = await Promise.all([
        Order.countDocuments({ 
          $or: [
            { orderDate: { $gte: startOfThisWeek } },
            { createdAt: { $gte: startOfThisWeek } }
          ]
        }),
        Order.countDocuments({ 
          $or: [
            { orderDate: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
            { createdAt: { $gte: startOfLastWeek, $lt: startOfThisWeek } }
          ]
        }),
      ]);
      finalStats.totalOrders = thisWeekOrders;
      const diff = thisWeekOrders - lastWeekOrders;
      finalStats.ordersChange.value = diff;
      finalStats.ordersChange.percentage = lastWeekOrders > 0 ? ((diff / lastWeekOrders) * 100).toFixed(2) : 0;
      console.log("This week orders:", thisWeekOrders, "Last week orders:", lastWeekOrders);
    } catch (e) { console.error("Failed to get order counts:", e.message); }

    // --- 2. Total Revenue & Monthly Growth ---
    try {
      const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
        Order.aggregate([
          { 
            $match: { 
              $or: [
                { orderDate: { $gte: startOfCurrentMonth } },
                { createdAt: { $gte: startOfCurrentMonth } }
              ],
              $expr: { $in: [{ $toLower: "$orderStatus" }, ["delivered", "confirmed"]] }, 
              $expr: { $eq: [{ $toLower: "$paymentStatus" }, "paid"] } 
            } 
          },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Order.aggregate([
          { 
            $match: { 
              $or: [
                { orderDate: { $gte: startOfLastMonth, $lte: endOfLastMonth } },
                { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }
              ],
              $expr: { $in: [{ $toLower: "$orderStatus" }, ["delivered", "confirmed"]] }, 
              $expr: { $eq: [{ $toLower: "$paymentStatus" }, "paid"] } 
            } 
          },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
      ]);
      finalStats.totalRevenue = currentMonthRevenue[0]?.total || 0;
      const current = finalStats.totalRevenue;
      const last = lastMonthRevenue[0]?.total || 0;
      if (last > 0) {
        finalStats.revenueGrowthPercentage = ((current - last) / last * 100).toFixed(2);
      }
      console.log("Current month revenue:", current, "Last month revenue:", last);
    } catch (e) { console.error("Failed to get revenue:", e.message); }

    // --- 3. Pending Orders & Weekly Change ---
    try {
      const [thisWeekPending, lastWeekPending] = await Promise.all([
        Order.countDocuments({ 
          $or: [
            { orderDate: { $gte: startOfThisWeek } },
            { createdAt: { $gte: startOfThisWeek } }
          ],
          $expr: { $eq: [{ $toLower: "$orderStatus" }, "pending"] } 
        }),
        Order.countDocuments({ 
          $or: [
            { orderDate: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
            { createdAt: { $gte: startOfLastWeek, $lt: startOfThisWeek } }
          ],
          $expr: { $eq: [{ $toLower: "$orderStatus" }, "pending"] } 
        }),
      ]);
      finalStats.pendingOrders = thisWeekPending;
      const diff = thisWeekPending - lastWeekPending;
      finalStats.pendingChange.value = diff;
      finalStats.pendingChange.percentage = lastWeekPending > 0 ? ((diff / lastWeekPending) * 100).toFixed(2) : 0;
      console.log("This week pending:", thisWeekPending, "Last week pending:", lastWeekPending);
    } catch (e) { console.error("Failed to get pending counts:", e.message); }

    // --- 4. Delivered Orders & Weekly Change ---
    try {
      const [thisWeekDelivered, lastWeekDelivered] = await Promise.all([
        Order.countDocuments({ 
          $or: [
            { orderDate: { $gte: startOfThisWeek } },
            { createdAt: { $gte: startOfThisWeek } }
          ],
          $expr: { $eq: [{ $toLower: "$orderStatus" }, "delivered"] } 
        }),
        Order.countDocuments({ 
          $or: [
            { orderDate: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
            { createdAt: { $gte: startOfLastWeek, $lt: startOfThisWeek } }
          ],
          $expr: { $eq: [{ $toLower: "$orderStatus" }, "delivered"] } 
        }),
      ]);
      finalStats.deliveredOrders = thisWeekDelivered;
      const diff = thisWeekDelivered - lastWeekDelivered;
      finalStats.deliveredChange.value = diff;
      finalStats.deliveredChange.percentage = lastWeekDelivered > 0 ? ((diff / lastWeekDelivered) * 100).toFixed(2) : 0;
      console.log("This week delivered:", thisWeekDelivered, "Last week delivered:", lastWeekDelivered);
    } catch (e) { console.error("Failed to get delivered counts:", e.message); }

    // --- 5. Total Customers & Weekly Change ---
    try {
      const [thisWeekCustomers, lastWeekCustomers] = await Promise.all([
        Order.distinct("userId", { 
          $or: [
            { orderDate: { $gte: startOfThisWeek } },
            { createdAt: { $gte: startOfThisWeek } }
          ]
        }),
        Order.distinct("userId", { 
          $or: [
            { orderDate: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
            { createdAt: { $gte: startOfLastWeek, $lt: startOfThisWeek } }
          ]
        }),
      ]);
      const thisWeekCount = thisWeekCustomers.length;
      const lastWeekCount = lastWeekCustomers.length;
      finalStats.totalCustomers = thisWeekCount;
      const diff = thisWeekCount - lastWeekCount;
      finalStats.customersChange.value = diff;
      finalStats.customersChange.percentage = lastWeekCount > 0 ? ((diff / lastWeekCount) * 100).toFixed(2) : 0;
      console.log("This week customers:", thisWeekCount, "Last week customers:", lastWeekCount);
    } catch (e) { console.error("Failed to get customer counts:", e.message); }

    // --- 6. Top 5 Selling Products ---
    try {
      const topProducts = await Order.aggregate([
        { $unwind: "$cartItems" },
        {
          $addFields: {
            cleanPrice: {
              $replaceAll: {
                input: {
                  $replaceAll: { input: "$cartItems.price", find: { $literal: "$" }, replacement: "" },
                },
                find: { $literal: "₹" },
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
          },
        },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
      ]);
      finalStats.topProducts = topProducts;
    } catch (e) { console.error("Failed to get top products:", e.message); }

    // Debug log to check the final stats
    console.log("Final stats:", finalStats);

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
      { 
        $match: { 
          $or: [
            { orderDate: { $gte: last30Days } },
            { createdAt: { $gte: last30Days } }
          ]
        } 
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

// Add this to your admin order routes (router.get("/debug", ...))

export const debugOrders = async (req, res) => {
  try {
    const orders = await Order.find({});
    const statusCounts = {};
    
    orders.forEach(order => {
      const status = order.orderStatus?.toLowerCase();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    res.json({ 
      success: true, 
      data: {
        totalOrders: orders.length,
        statusCounts,
        sampleOrders: orders.slice(0, 5).map(o => ({
          id: o._id,
          status: o.orderStatus,
          paymentStatus: o.paymentStatus,
          date: o.orderDate || o.createdAt
        }))
      }
    });
  } catch (error) {
    console.error("Debug orders error:", error);
    res.status(500).json({ success: false, message: "Failed to debug orders" });
  }
};
