// src/controllers/admin/order-stats-controller.js
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";   // <-- NEW

// ──────────────────────────────────────────────────────────────
// Helper: date ranges (this week, last week, current/last month)
// ──────────────────────────────────────────────────────────────
const getDateRanges = () => {
  const now = new Date();

  // This week (Mon-Sun)
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  // Current month
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  return {
    startOfThisWeek,
    startOfLastWeek,
    startOfCurrentMonth,
    startOfLastMonth,
    endOfLastMonth,
  };
};

// ──────────────────────────────────────────────────────────────
// 1. GET /admin/orders/stats
// ──────────────────────────────────────────────────────────────
export const getOrderStats = async (req, res) => {
  try {
    const {
      startOfThisWeek,
      startOfLastWeek,
      startOfCurrentMonth,
      startOfLastMonth,
      endOfLastMonth,
    } = getDateRanges();

    // ----- Default shape (never null) -----
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
    };

    // -------------------------------------------------
    // 1. Confirmed & Shipped (extra counters)
    // -------------------------------------------------
    finalStats.confirmedOrders = await Order.countDocuments({ orderStatus: /confirmed/i });
    finalStats.shippedOrders = await Order.countDocuments({ orderStatus: /shipped/i });

    // -------------------------------------------------
    // 2. Low-stock products (max 5)
    // -------------------------------------------------
    finalStats.lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    // -------------------------------------------------
    // 3. Total orders (this week) + change
    // -------------------------------------------------
    const [thisWeekOrders, lastWeekOrders] = await Promise.all([
      Order.countDocuments({
        $or: [{ orderDate: { $gte: startOfThisWeek } }, { createdAt: { $gte: startOfThisWeek } }],
      }),
      Order.countDocuments({
        $or: [
          { orderDate: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
          { createdAt: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
        ],
      }),
    ]);
    finalStats.totalOrders = thisWeekOrders;
    const ordersDiff = thisWeekOrders - lastWeekOrders;
    finalStats.ordersChange.value = ordersDiff;
    finalStats.ordersChange.percentage =
      lastWeekOrders > 0 ? ((ordersDiff / lastWeekOrders) * 100).toFixed(2) : 0;

    // -------------------------------------------------
    // 4. Revenue (current month) + growth
    // -------------------------------------------------
    const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            $or: [{ orderDate: { $gte: startOfCurrentMonth } }, { createdAt: { $gte: startOfCurrentMonth } }],
            orderStatus: /delivered|confirmed/i,
            paymentStatus: /paid/i,
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            $or: [
              { orderDate: { $gte: startOfLastMonth, $lte: endOfLastMonth } },
              { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } },
            ],
            orderStatus: /delivered|confirmed/i,
            paymentStatus: /paid/i,
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

    finalStats.totalRevenue = currentMonthRevenue[0]?.total || 0;
    const lastRev = lastMonthRevenue[0]?.total || 0;
    finalStats.revenueGrowthPercentage = lastRev > 0 ? (((finalStats.totalRevenue - lastRev) / lastRev) * 100).toFixed(2) : 0;

    // -------------------------------------------------
    // 5. Pending orders (this week) + change
    // -------------------------------------------------
    const pendingRegex = /pending|processing|confirmed/i;
    const [thisWeekPending, lastWeekPending] = await Promise.all([
      Order.countDocuments({
        $or: [{ orderDate: { $gte: startOfThisWeek } }, { createdAt: { $gte: startOfThisWeek } }],
        orderStatus: pendingRegex,
      }),
      Order.countDocuments({
        $or: [
          { orderDate: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
          { createdAt: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
        ],
        orderStatus: pendingRegex,
      }),
    ]);
    finalStats.pendingOrders = thisWeekPending;
    const pendingDiff = thisWeekPending - lastWeekPending;
    finalStats.pendingChange.value = pendingDiff;
    finalStats.pendingChange.percentage =
      lastWeekPending > 0
        ? ((pendingDiff / lastWeekPending) * 100).toFixed(2)
        : thisWeekPending > 0
        ? "100.00"
        : "0.00";

    // -------------------------------------------------
    // 6. Delivered orders (this week) + change
    // -------------------------------------------------
    const deliveredRegex = /delivered|completed|shipped/i;
    const [thisWeekDelivered, lastWeekDelivered] = await Promise.all([
      Order.countDocuments({
        $or: [{ orderDate: { $gte: startOfThisWeek } }, { createdAt: { $gte: startOfThisWeek } }],
        orderStatus: deliveredRegex,
      }),
      Order.countDocuments({
        $or: [
          { orderDate: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
          { createdAt: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
        ],
        orderStatus: deliveredRegex,
      }),
    ]);
    finalStats.deliveredOrders = thisWeekDelivered;
    const deliveredDiff = thisWeekDelivered - lastWeekDelivered;
    finalStats.deliveredChange.value = deliveredDiff;
    finalStats.deliveredChange.percentage =
      lastWeekDelivered > 0
        ? ((deliveredDiff / lastWeekDelivered) * 100).toFixed(2)
        : thisWeekDelivered > 0
        ? "100.00"
        : "0.00";

    // -------------------------------------------------
    // 7. Unique customers (this week) + change
    // -------------------------------------------------
    const [thisWeekCust, lastWeekCust] = await Promise.all([
      Order.distinct("userId", {
        $or: [{ orderDate: { $gte: startOfThisWeek } }, { createdAt: { $gte: startOfThisWeek } }],
      }),
      Order.distinct("userId", {
        $or: [
          { orderDate: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
          { createdAt: { $gte: startOfLastWeek, $lt: startOfThisWeek } },
        ],
      }),
    ]);
    finalStats.totalCustomers = thisWeekCust.length;
    const custDiff = thisWeekCust.length - lastWeekCust.length;
    finalStats.customersChange.value = custDiff;
    finalStats.customersChange.percentage =
      lastWeekCust.length > 0 ? ((custDiff / lastWeekCust.length) * 100).toFixed(2) : 0;

    // -------------------------------------------------
    // 8. Top 5 products (by quantity sold)
    // -------------------------------------------------
   const topProducts = await Order.aggregate([
      { $unwind: "$cartItems" }, // FIXED: matches schema field
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

    // -------------------------------------------------
    // Send response
    // -------------------------------------------------
    res.json({ success: true, data: finalStats });
  } catch (error) {
    console.error("getOrderStats ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch order stats" });
  }
};

// ──────────────────────────────────────────────────────────────
// 2. GET /admin/orders/sales-overview (30-day line chart)
// ──────────────────────────────────────────────────────────────
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
