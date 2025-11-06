// src/controllers/admin/order-stats-controller.js

import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";

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
    
    // Debug: Check order structure
    const sampleOrder = await Order.findOne({});
    console.log("Sample order structure:", JSON.stringify(sampleOrder, null, 2));
    
    // Determine which field contains the order items
    let itemField = "cartItems"; // default
    if (sampleOrder) {
      if (sampleOrder.cartItems && Array.isArray(sampleOrder.cartItems) && sampleOrder.cartItems.length > 0) {
        itemField = "cartItems";
      } else if (sampleOrder.items && Array.isArray(sampleOrder.items) && sampleOrder.items.length > 0) {
        itemField = "items";
      }
    }
    console.log("Using item field:", itemField);
    
    // ──────────────────────────────
    // 1. Extra Counters
    // ──────────────────────────────
    finalStats.confirmedOrders = await Order.countDocuments({ orderStatus: /confirmed/i });
    finalStats.shippedOrders = await Order.countDocuments({ orderStatus: /shipped/i });

    // ──────────────────────────────
    // 2. Low Stock
    // ──────────────────────────────
    finalStats.lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    // ──────────────────────────────
    // 3. Orders this/last week
    // ──────────────────────────────
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
    finalStats.ordersChange = {
      value: ordersDiff,
      percentage: lastWeekOrders > 0 ? ((ordersDiff / lastWeekOrders) * 100).toFixed(2) : 0,
    };

    // ──────────────────────────────
    // 4. Revenue current vs last month
    // ──────────────────────────────
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
    finalStats.revenueGrowthPercentage =
      lastRev > 0 ? (((finalStats.totalRevenue - lastRev) / lastRev) * 100).toFixed(2) : 0;

    // ──────────────────────────────
    // 5. Pending Orders
    // ──────────────────────────────
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
    finalStats.pendingChange = {
      value: thisWeekPending - lastWeekPending,
      percentage:
        lastWeekPending > 0
          ? (((thisWeekPending - lastWeekPending) / lastWeekPending) * 100).toFixed(2)
          : thisWeekPending > 0
          ? "100.00"
          : "0.00",
    };

    // ──────────────────────────────
    // 6. Delivered Orders
    // ──────────────────────────────
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
    finalStats.deliveredChange = {
      value: thisWeekDelivered - lastWeekDelivered,
      percentage:
        lastWeekDelivered > 0
          ? (((thisWeekDelivered - lastWeekDelivered) / lastWeekDelivered) * 100).toFixed(2)
          : thisWeekDelivered > 0
          ? "100.00"
          : "0.00",
    };

    // ──────────────────────────────
    // 7. Unique Customers
    // ──────────────────────────────
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
    finalStats.customersChange = {
      value: thisWeekCust.length - lastWeekCust.length,
      percentage:
        lastWeekCust.length > 0
          ? (((thisWeekCust.length - lastWeekCust.length) / lastWeekCust.length) * 100).toFixed(2)
          : 0,
    };

    // ──────────────────────────────
    // 8. Top 5 Products (FIXED)
    // ──────────────────────────────
    try {
      console.log("Running top products aggregation with field:", itemField);
      
      // First, let's see what the raw data looks like
      const rawItems = await Order.aggregate([
        { $limit: 5 },
        { $project: { [itemField]: 1 } }
      ]);
      console.log("Raw items data:", JSON.stringify(rawItems, null, 2));
      
      const topProductsAgg = await Order.aggregate([
        { $unwind: `$${itemField}` },
        {
          $lookup: {
            from: "products",
            localField: `${itemField}.productId`,
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $group: {
            _id: `$${itemField}.productId`,
            title: { $first: "$product.title" },
            image: { $first: { $ifNull: [{ $arrayElemAt: ["$product.images", 0] }, "$product.image"] } },
            totalQty: { $sum: `$${itemField}.quantity` },
            revenue: { 
              $sum: { 
                $multiply: [
                  `$${itemField}.quantity`, 
                  { $toDouble: { 
                    $replaceAll: {
                      input: { 
                        $replaceAll: { 
                          input: `$${itemField}.price`, 
                          find: "$", 
                          replacement: "" 
                        } 
                      },
                      find: "₹",
                      replacement: ""
                    }
                  }}
                ] 
              } 
            },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]);
      
      console.log("Top products aggregation result:", JSON.stringify(topProductsAgg, null, 2));
      finalStats.topProducts = topProductsAgg;
    } catch (error) {
      console.error("Error in top products aggregation:", error);
      // Fallback to simpler aggregation if the complex one fails
      try {
        const simpleTopProducts = await Order.aggregate([
          { $unwind: `$${itemField}` },
          {
            $group: {
              _id: `$${itemField}.productId`,
              title: { $first: `$${itemField}.title` },
              image: { $first: `$${itemField}.image` },
              totalQty: { $sum: `$${itemField}.quantity` },
            },
          },
          { $sort: { totalQty: -1 } },
          { $limit: 5 },
        ]);
        console.log("Simple top products result:", JSON.stringify(simpleTopProducts, null, 2));
        finalStats.topProducts = simpleTopProducts;
      } catch (simpleError) {
        console.error("Error in simple top products aggregation:", simpleError);
      }
    }

   // ──────────────────────────────
// 9. SALES BY CATEGORY (FIXED & SAFE)
// ──────────────────────────────
try {
  console.log("Running category sales aggregation with field:", itemField);

  // First, let's check what categories exist
  const categories = await Category.find({});
  console.log("Available categories:", categories.map(c => ({ id: c._id, name: c.name })));

  const categoryAgg = await Order.aggregate([
    { $unwind: `$${itemField}` },
    {
      $lookup: {
        from: "products",
        localField: `${itemField}.productId`,
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },

    // If your Product model uses "categoryId" (ObjectId) to reference Category
    {
      $lookup: {
        from: "categories",
        localField: "product.categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      // Safely unwind in case category is missing
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: {
          $ifNull: ["$category.name", "Uncategorized"],
        },
        revenue: {
          $sum: {
            $multiply: [
              `$${itemField}.quantity`,
              {
                // Handle both numeric and string prices
                $cond: {
                  if: { $isNumber: `$${itemField}.price` },
                  then: `$${itemField}.price`,
                  else: {
                    $toDouble: {
                      $replaceAll: {
                        input: {
                          $replaceAll: {
                            input: {
                              $ifNull: [`$${itemField}.price`, "0"],
                            },
                            find: "₹",
                            replacement: "",
                          },
                        },
                        find: "$",
                        replacement: "",
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  console.log("Category sales aggregation result:", JSON.stringify(categoryAgg, null, 2));

  // Format the data for the chart
  finalStats.categorySales = categoryAgg.map((c) => ({
    name: c._id || "Unknown Category",
    value: c.revenue || 0,
  }));
  
  console.log("Formatted category sales data:", JSON.stringify(finalStats.categorySales, null, 2));
} catch (error) {
  console.error("Error in category sales aggregation:", error);

  // Fallback: simple aggregation if lookup fails
  try {
    const simpleCategoryAgg = await Order.aggregate([
      { $unwind: `$${itemField}` },
      {
        $group: {
          _id: `$${itemField}.category` || "Uncategorized",
          revenue: { $sum: `$${itemField}.price` },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Format the data for the chart
    finalStats.categorySales = simpleCategoryAgg.map((c) => ({
      name: c._id || "Uncategorized",
      value: c.revenue || 0,
    }));
    
    console.log("Formatted fallback category sales data:", JSON.stringify(finalStats.categorySales, null, 2));
  } catch (simpleError) {
    console.error("Error in simple category sales aggregation:", simpleError);
    // Provide empty array with default category
    finalStats.categorySales = [{ name: "No Data", value: 0 }];
  }
}
    
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
