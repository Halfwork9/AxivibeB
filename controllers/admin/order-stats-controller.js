// src/controllers/admin/order-stats-controller.js
import mongoose from "mongoose";
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Brand from "../../models/Brand.js";
import User from "../../models/User.js";
import AnalyticsCache from "../../models/AnalyticsCache.js"; // cache collection

//------------------------------------------------
// Helper: detect the item array field present in orders
//------------------------------------------------
async function detectItemField() {
  const hasCart = await Order.exists({ cartItems: { $exists: true, $ne: [] } });
  if (hasCart) return "cartItems";
  const hasItems = await Order.exists({ items: { $exists: true, $ne: [] } });
  if (hasItems) return "items";
  return "cartItems";
}

// Simple util to upsert cache
async function setCache(key, data) {
  await AnalyticsCache.findOneAndUpdate(
    { key },
    { data, updatedAt: new Date() },
    { upsert: true }
  );
}

//------------------------------------------------
// GET /admin/orders/stats (Cached & Optimized)
//------------------------------------------------
export const getOrderStats = async (req, res) => {
  try {
    const CACHE_KEY = "admin:order_stats";
    const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

    // Try cache
    const cache = await AnalyticsCache.findOne({ key: CACHE_KEY });
    if (cache && Date.now() - cache.updatedAt.getTime() < CACHE_TTL_MS) {
      return res.json({ success: true, data: cache.data });
    }

    console.log("⚙️ Recomputing dashboard stats...");
    const finalStats = {
      // Core KPIs
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      deliveredOrders: 0,
      totalCustomers: 0,
      avgOrderValue: 0,
      repeatCustomers: 0,
      repeatCustomerRate: 0,
      cancelRate: 0,
      returnRate: 0,

      // inventory / quick lists
      lowStock: [],

      // analytics buckets
      topProducts: [],
      topCustomers: [],
      brandSalesPerformance: [],
      categorySales: [],
      paymentMethodBreakdown: [],

      todayRevenue: 0,
      weeklyRevenue: 0,
      monthlyRevenue: 0,

      bestSellingBrand: null,
      bestSellingCategory: null,
    };

    // Detect item field
    const itemField = await detectItemField();

    //------------------------------------------------
    // 1) Basic counts (parallel)
    //------------------------------------------------
    const [
      totalOrders,
      deliveredOrders,
      pendingOrders,
      confirmedOrders,
      shippedOrders,
      uniqueCustomers,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: /delivered|completed|shipped/i }),
      Order.countDocuments({ orderStatus: /pending|processing|confirmed/i }),
      Order.countDocuments({ orderStatus: /confirmed/i }),
      Order.countDocuments({ orderStatus: /shipped/i }),
      Order.distinct("userId"),
    ]);

    finalStats.totalOrders = totalOrders;
    finalStats.deliveredOrders = deliveredOrders;
    finalStats.pendingOrders = pendingOrders;
    finalStats.totalCustomers = uniqueCustomers.length;

   //------------------------------------------------
// 2) Daily / Weekly / Monthly Revenue
//------------------------------------------------
try {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const revAgg = await Order.aggregate([
    {
      $facet: {
        today: [
          {
            $match: {
              $and: [
                {
                  $or: [
                    { orderDate: { $gte: todayStart } },
                    { createdAt: { $gte: todayStart } },
                  ],
                },
                {
                  orderStatus: {
                    $in: [
                      "Delivered", "delivered",
                      "Completed", "completed",
                      "Shipped", "shipped"
                    ],
                  },
                },
              ],
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$totalAmount" },
            },
          },
        ],

        weekly: [
          {
            $match: {
              $and: [
                {
                  $or: [
                    { orderDate: { $gte: weekStart } },
                    { createdAt: { $gte: weekStart } },
                  ],
                },
                {
                  orderStatus: {
                    $in: [
                      "Delivered", "delivered",
                      "Completed", "completed",
                      "Shipped", "shipped"
                    ],
                  },
                },
              ],
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$totalAmount" },
            },
          },
        ],

        monthly: [
          {
            $match: {
              $and: [
                {
                  $or: [
                    { orderDate: { $gte: monthStart } },
                    { createdAt: { $gte: monthStart } },
                  ],
                },
                {
                  orderStatus: {
                    $in: [
                      "Delivered", "delivered",
                      "Completed", "completed",
                      "Shipped", "shipped"
                    ],
                  },
                },
              ],
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$totalAmount" },
            },
          },
        ],
      },
    },
  ]);

  finalStats.todayRevenue = revAgg[0]?.today?.[0]?.total ?? 0;
  finalStats.weeklyRevenue = revAgg[0]?.weekly?.[0]?.total ?? 0;
  finalStats.monthlyRevenue = revAgg[0]?.monthly?.[0]?.total ?? 0;

} catch (e) {
  console.log("⚠ Revenue calc error →", e.message);
}

    //------------------------------------------------
    // 3) Low stock
    //------------------------------------------------
    try {
      finalStats.lowStock = await Product.find({ totalStock: { $lt: 10 } })
        .select("title totalStock")
        .limit(5)
        .lean();
    } catch (e) {
      finalStats.lowStock = [];
      console.log("⚠ lowStock error →", e.message);
    }

    //------------------------------------------------
    // 4) Total Revenue & AOV (lifetime)
    //------------------------------------------------
    try {
      const revenueAgg = await Order.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]);
      const revenue = revenueAgg[0]?.total ?? 0;
      finalStats.totalRevenue = revenue;
      finalStats.avgOrderValue = totalOrders > 0 ? Number((revenue / totalOrders).toFixed(2)) : 0;
    } catch (e) {
      console.log("⚠ revenue/AOV error →", e.message);
    }

    //------------------------------------------------
    // 5) Repeat customers
    //------------------------------------------------
    try {
      const customerOrderCount = await Order.aggregate([{ $group: { _id: "$userId", count: { $sum: 1 } } }]);
      const repeatUsers = customerOrderCount.filter((u) => (u?.count || 0) > 1).length;
      finalStats.repeatCustomers = repeatUsers;
      finalStats.repeatCustomerRate =
        uniqueCustomers.length > 0 ? Number(((repeatUsers / uniqueCustomers.length) * 100).toFixed(2)) : 0;
    } catch (e) {
      console.log("⚠ repeat customers error →", e.message);
    }

    //------------------------------------------------
    // 6) Cancel & Return rates
    //------------------------------------------------
    try {
      const [cancelled, returned] = await Promise.all([
        Order.countDocuments({ orderStatus: /cancel/i }),
        Order.countDocuments({ orderStatus: /return/i }),
      ]);
      finalStats.cancelRate = totalOrders > 0 ? Number(((cancelled / totalOrders) * 100).toFixed(2)) : 0;
      finalStats.returnRate = totalOrders > 0 ? Number(((returned / totalOrders) * 100).toFixed(2)) : 0;
    } catch (e) {
      console.log("⚠ cancel/return error →", e.message);
    }

    //------------------------------------------------
    // 7) Top Products (buyers + qty) — normalize items to itemsNormalized
    //------------------------------------------------
    try {
      const topProductsAgg = await Order.aggregate([
        // Project a unified itemsNormalized array (prefer cartItems else items)
        {
          $project: {
            itemsNormalized: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$cartItems", []] } }, 0] },
                "$cartItems",
                "$items",
              ],
            },
            userId: 1,
          },
        },
        { $unwind: "$itemsNormalized" },
        {
          $addFields: {
            qty: { $toDouble: { $ifNull: ["$itemsNormalized.quantity", 0] } },
          },
        },
        // Join product
        {
          $lookup: {
            from: "products",
            localField: "itemsNormalized.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $group: {
            _id: "$product._id",
            title: { $first: "$product.title" },
            image: { $first: { $arrayElemAt: ["$product.images", 0] } },
            totalQty: { $sum: "$qty" },
            buyersArr: { $addToSet: "$userId" },
          },
        },
        {
          $addFields: {
            buyers: { $size: "$buyersArr" },
          },
        },
        { $sort: { buyers: -1, totalQty: -1 } },
        { $limit: 10 },
      ]);

      finalStats.topProducts = topProductsAgg.map((p) => ({
        _id: p._id,
        title: p.title,
        image: p.image,
        buyers: p.buyers ?? 0,
        totalQty: p.totalQty ?? 0,
      }));
    } catch (e) {
      finalStats.topProducts = [];
      console.log("⚠ topProducts error →", e.message);
    }

    //------------------------------------------------
    // 8)Top Customers (lifetime)
    //------------------------------------------------
  let topCustomers = [];
try {
  const topCustAgg = await Order.aggregate([
    {
      $group: {
        _id: "$userId",
        totalSpent: { $sum: "$totalAmount" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { totalSpent: -1 } },
    { $limit: 5 },
  ]);

  topCustomers = await Promise.all(
    topCustAgg.map(async (c) => {
      if (!c._id) return null;

      const user = await User.findById(c._id).select("userName email");

      return {
        userId: c._id,
        name: user?.userName || "Unknown",
        email: user?.email || "",
        orderCount: c.orderCount,
        totalSpent: c.totalSpent,
      };
    })
  );

  finalStats.topCustomers = topCustomers.filter(Boolean);
} catch (err) {
  console.log("⚠ topCustomers error →", err.message);
}


    //------------------------------------------------
    // 9) Brand Sales Performance (using itemsNormalized)
    //------------------------------------------------
    try {
      const brandAgg = await Order.aggregate([
        {
          $project: {
            itemsNormalized: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$cartItems", []] } }, 0] },
                "$cartItems",
                "$items",
              ],
            },
            orderId: "$_id",
          },
        },
        { $unwind: "$itemsNormalized" },

        // Convert to numbers
        {
          $addFields: {
            qty: { $toDouble: { $ifNull: ["$itemsNormalized.quantity", 0] } },
            price: { $toDouble: { $ifNull: ["$itemsNormalized.price", 0] } },
            productId: "$itemsNormalized.productId",
          },
        },

        // Join product
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },

        // Join brand
        {
          $lookup: {
            from: "brands",
            localField: "product.brandId",
            foreignField: "_id",
            as: "brand",
          },
        },
        { $unwind: "$brand" },

        {
          $group: {
            _id: "$brand._id",
            brand: { $first: "$brand.name" },
            qty: { $sum: "$qty" },
            revenue: { $sum: { $multiply: ["$qty", "$price"] } },
            orderIds: { $addToSet: "$orderId" },
          },
        },
        {
          $addFields: {
            orderCount: { $size: "$orderIds" },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]);

      finalStats.brandSalesPerformance = brandAgg.map((b) => ({
        _id: b._id,
        brand: b.brand,
        qty: b.qty,
        revenue: b.revenue,
        orderCount: b.orderCount,
      }));
    } catch (e) {
      finalStats.brandSalesPerformance = [];
      console.log("⚠ brandSales error →", e.message);
    }

    //------------------------------------------------
    // 10) Payment method distribution
    //------------------------------------------------
    try {
      const paymentDistRaw = await Order.aggregate([
        { $group: { _id: { $toLower: { $ifNull: ["$paymentMethod", "unknown"] } }, count: { $sum: 1 } } },
      ]);
      const normalized = {};
      paymentDistRaw.forEach((p) => {
        let key = p._id;
        if (key.includes("cod") || key.includes("cash")) key = "Cash on Delivery";
        else if (key.includes("stripe")) key = "Stripe";
        else key = key || "Unknown";
        normalized[key] = (normalized[key] || 0) + p.count;
      });
      finalStats.paymentMethodBreakdown = Object.entries(normalized).map(([method, count]) => ({ method, count }));
    } catch (e) {
      finalStats.paymentMethodBreakdown = [];
      console.log("⚠ paymentMethod error →", e.message);
    }

    //------------------------------------------------
    // 11) Category sales (by revenue) - itemsNormalized
    //------------------------------------------------
    try {
      const catAgg = await Order.aggregate([
        {
          $project: {
            itemsNormalized: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$cartItems", []] } }, 0] },
                "$cartItems",
                "$items",
              ],
            },
          },
        },
        { $unwind: "$itemsNormalized" },
        {
          $addFields: {
            _qty: { $toDouble: { $ifNull: ["$itemsNormalized.quantity", 0] } },
            _price: { $toDouble: { $ifNull: ["$itemsNormalized.price", 0] } },
            productId: "$itemsNormalized.productId",
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $lookup: {
            from: "categories",
            localField: "product.categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $group: {
            _id: "$category.name",
            revenue: { $sum: { $multiply: ["$_qty", "$_price"] } },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]);

      finalStats.categorySales = catAgg.map((c) => ({ name: c._id || "Unknown", value: c.revenue || 0 }));
    } catch (e) {
      finalStats.categorySales = [];
      console.log("⚠ categorySales error →", e.message);
    }

    //------------------------------------------------
    // 12) Best brand & category (based on topProducts buyers/qty)
    //------------------------------------------------
    try {
      if (finalStats.topProducts?.length > 0) {
        const brandMap = {};
        const categoryMap = {};

        for (const p of finalStats.topProducts) {
          const product = await Product.findById(p._id).select("brandId categoryId").populate("brandId", "name").populate("categoryId", "name").lean();
          if (!product) continue;

          const brandName = product.brandId?.name || "Unknown";
          const categoryName = product.categoryId?.name || "Unknown";

          brandMap[brandName] = brandMap[brandName] || { buyers: 0, qty: 0 };
          brandMap[brandName].buyers += p.buyers || 0;
          brandMap[brandName].qty += p.totalQty || 0;

          categoryMap[categoryName] = categoryMap[categoryName] || { buyers: 0, qty: 0 };
          categoryMap[categoryName].buyers += p.buyers || 0;
          categoryMap[categoryName].qty += p.totalQty || 0;
        }

        const sortedBrands = Object.entries(brandMap).sort((a, b) => {
          if (b[1].buyers !== a[1].buyers) return b[1].buyers - a[1].buyers;
          return b[1].qty - a[1].qty;
        });
        finalStats.bestSellingBrand = sortedBrands[0]?.[0] ?? null;

        const sortedCategories = Object.entries(categoryMap).sort((a, b) => {
          if (b[1].buyers !== a[1].buyers) return b[1].buyers - a[1].buyers;
          return b[1].qty - a[1].qty;
        });
        finalStats.bestSellingCategory = sortedCategories[0]?.[0] ?? null;
      }
    } catch (e) {
      console.log("⚠ best brand/category calc error →", e.message);
    }

    //------------------------------------------------
    // Cache & return
    //------------------------------------------------
    try {
      await setCache(CACHE_KEY, finalStats);
      console.log("✅ Dashboard stats computed & cached");
    } catch (e) {
      console.log("⚠ cache set error →", e.message);
    }

    return res.json({ success: true, data: finalStats });
  } catch (error) {
    console.error("getOrderStats ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch order stats" });
  }
};

//------------------------------------------------
// GET /admin/orders/sales-overview (30-day line chart) — cached
//------------------------------------------------
export const getSalesOverview = async (req, res) => {
  try {
    const CACHE_KEY = "admin:sales_overview";
    const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

    const cache = await AnalyticsCache.findOne({ key: CACHE_KEY });
    if (cache && Date.now() - cache.updatedAt.getTime() < CACHE_TTL_MS) {
      return res.json({ success: true, data: cache.data });
    }

    const now = new Date();
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 29); // inclusive last 30 days

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

    // Build 30-day timeline (guarantee full timeline)
    const map = {};
    raw.forEach((d) => {
      const dateStr = `${d._id.day}/${d._id.month}`;
      map[dateStr] = { date: dateStr, revenue: d.revenue, orders: d.orders };
    });

    const formatted = [];
    const temp = new Date(last30Days);
    for (let i = 0; i < 30; i++) {
      const dateStr = `${temp.getDate()}/${temp.getMonth() + 1}`;
      formatted.push(map[dateStr] || { date: dateStr, revenue: 0, orders: 0 });
      temp.setDate(temp.getDate() + 1);
    }

    // Cache
    try {
      await setCache(CACHE_KEY, formatted);
    } catch (e) {
      console.log("⚠ sales overview cache error →", e.message);
    }

    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("getSalesOverview ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch sales overview" });
  }
};

//------------------------------------------------
export const getMonthlyRevenue = async (req, res) => {
  try {
    const { monthsBack, month: qMonth, year: qYear } = req.query;

    let start, end;

    if (qMonth !== undefined && qYear !== undefined) {
      const monthNum = Number(qMonth) - 1;
      const yearNum = Number(qYear);
      start = new Date(yearNum, monthNum, 1);
      end = new Date(yearNum, monthNum + 1, 1);
    } else {
      const mb = Number(isNaN(Number(monthsBack)) ? 0 : Number(monthsBack));
      const now = new Date();
      const target = new Date(now.getFullYear(), now.getMonth() - mb, 1);
      start = new Date(target.getFullYear(), target.getMonth(), 1);
      end = new Date(target.getFullYear(), target.getMonth() + 1, 1);
    }

    const agg = await Order.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [
                { orderDate: { $gte: start, $lt: end } },
                { createdAt: { $gte: start, $lt: end } }
              ]
            },
            {
              orderStatus: {
                $in: [
                  "Delivered", "delivered",
                  "Completed", "completed",
                  "Shipped", "shipped"
                ]
              }
            }
          ]
        }
      },

      // FIX: Correct revenue calculation
      {
        $group: {
          _id: null,
          revenue: {
            $sum: {
              $cond: [
                { $gt: ["$totalAmount", 0] },
                "$totalAmount",
                {
                  $cond: [
                    { $gt: ["$orderTotal", 0] },
                    "$orderTotal",
                    { $ifNull: ["$total", 0] }
                  ]
                }
              ]
            }
          }
        }
      }
    ]);

    const revenue = agg[0]?.revenue || 0;

    const monthLabel = start.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    return res.json({ success: true, monthLabel, revenue });
  } catch (err) {
    console.error("getMonthlyRevenue error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch monthly revenue",
    });
  }
};

