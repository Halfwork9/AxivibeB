// src/controllers/admin/order-stats-controller.js
import mongoose from "mongoose";
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Brand from "../../models/Brand.js";
import User from "../../models/User.js";
import AnalyticsCache from "../../models/AnalyticsCache.js"; // ✅ Mongo cache

//------------------------------------------------
// Helper: detect the item array field present in orders
//------------------------------------------------
async function detectItemField() {
  const hasCart = await Order.exists({ cartItems: { $exists: true, $ne: [] } });
  if (hasCart) return "cartItems";
  const hasItems = await Order.exists({ items: { $exists: true, $ne: [] } });
  if (hasItems) return "items";
  // default to cartItems if nothing found (prevents crashes on empty DB)
  return "cartItems";
}

//------------------------------------------------
// ✅ GET /admin/orders/stats (Cached & Optimized)
//------------------------------------------------
export const getOrderStats = async (req, res) => {
  try {
    const CACHE_KEY = "admin:order_stats";
    const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

    // 1️⃣ Try Mongo cache
    const cache = await AnalyticsCache.findOne({ key: CACHE_KEY });
    if (cache && Date.now() - cache.updatedAt.getTime() < CACHE_TTL_MS) {
      console.log("📦 Dashboard stats served from Mongo cache");
      return res.json({ success: true, data: cache.data });
    }

    console.log("⚙️ Recomputing dashboard stats...");
    const finalStats = {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      deliveredOrders: 0,
      confirmedOrders: 0,
      shippedOrders: 0,
      totalCustomers: 0,
      avgOrderValue: 0,
      repeatCustomers: 0,
      repeatCustomerRate: 0,
      cancelRate: 0,
      returnRate: 0,
      todayRevenue: 0,
      weeklyRevenue: 0,
      monthlyRevenue: 0,
      lowStock: [],
      topProducts: [],
      topCustomers: [],
      brandSalesPerformance: [],
      categorySales: [],
      paymentMethodBreakdown: [],
      bestSellingBrand: null,
      bestSellingCategory: null,
    };

    // Detect items field
    const itemField = await detectItemField();

    //------------------------------------------------
    // 1️⃣ Basic counts
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
    finalStats.confirmedOrders = confirmedOrders;
    finalStats.shippedOrders = shippedOrders;
    finalStats.totalCustomers = uniqueCustomers.length;

    //------------------------------------------------
    // 2️⃣ Daily / Weekly / Monthly Revenue
    //------------------------------------------------
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const revAgg = await Order.aggregate([
        {
          $facet: {
            today: [
              { $match: { orderDate: { $gte: todayStart } } },
              { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ],
            weekly: [
              { $match: { orderDate: { $gte: weekStart } } },
              { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ],
            monthly: [
              { $match: { orderDate: { $gte: monthStart } } },
              { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ],
          },
        },
      ]);

      finalStats.todayRevenue = revAgg[0]?.today[0]?.total ?? 0;
      finalStats.weeklyRevenue = revAgg[0]?.weekly[0]?.total ?? 0;
      finalStats.monthlyRevenue = revAgg[0]?.monthly[0]?.total ?? 0;
    } catch (e) {
      console.log("⚠ Revenue calc error →", e.message);
    }

    //------------------------------------------------
    // 3️⃣ Low stock
    //------------------------------------------------
    finalStats.lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    //------------------------------------------------
    // 4️⃣ Revenue & AOV
    //------------------------------------------------
    const revenueAgg = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const revenue = revenueAgg[0]?.total ?? 0;
    finalStats.totalRevenue = revenue;
    finalStats.avgOrderValue =
      totalOrders > 0 ? Number((revenue / totalOrders).toFixed(2)) : 0;

    //------------------------------------------------
    // 5️⃣ Repeat Customers
    //------------------------------------------------
    const customerOrderCount = await Order.aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]);
    const repeatUsers = customerOrderCount.filter((u) => (u?.count || 0) > 1).length;
    finalStats.repeatCustomers = repeatUsers;
    finalStats.repeatCustomerRate =
      uniqueCustomers.length > 0
        ? Number(((repeatUsers / uniqueCustomers.length) * 100).toFixed(2))
        : 0;

    //------------------------------------------------
    // 6️⃣ Cancellation & Return rates
    //------------------------------------------------
    const [cancelled, returned] = await Promise.all([
      Order.countDocuments({ orderStatus: /cancel/i }),
      Order.countDocuments({ orderStatus: /return/i }),
    ]);
    finalStats.cancelRate =
      totalOrders > 0 ? Number(((cancelled / totalOrders) * 100).toFixed(2)) : 0;
    finalStats.returnRate =
      totalOrders > 0 ? Number(((returned / totalOrders) * 100).toFixed(2)) : 0;

    //------------------------------------------------
    // 7️⃣ Top Products
    //------------------------------------------------
    try {
      const topProductsAgg = await Order.aggregate([
        { $match: { [itemField]: { $exists: true, $ne: [] } } },
        { $unwind: `$${itemField}` },
        {
          $addFields: {
            qty: { $toDouble: { $ifNull: [`$${itemField}.quantity`, 0] } },
          },
        },
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
    } catch (err) {
      console.log("⚠ topProducts error →", err.message);
    }

    //------------------------------------------------
    // 8️⃣ Top Customers
    //------------------------------------------------
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

      const users = await User.find({
        _id: { $in: topCustAgg.map((c) => c._id) },
      }).select("userName email");

      const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));
      finalStats.topCustomers = topCustAgg.map((c) => ({
        userId: c._id,
        name: userMap[c._id]?.userName || "Unknown",
        email: userMap[c._id]?.email || "",
        orderCount: c.orderCount,
        totalSpent: c.totalSpent,
      }));
    } catch (err) {
      console.log("⚠ topCustomers error →", err.message);
    }

    //------------------------------------------------
    // 9️⃣ Brand Sales Performance
    //------------------------------------------------
   
try {
  const brandAgg = await Order.aggregate([
    { $match: { cartItems: { $exists: true, $ne: [] } } },
    { $unwind: "$cartItems" },

    // Convert data to numbers
    {
      $addFields: {
        qty: { $toDouble: { $ifNull: ["$cartItems.quantity", 0] } },
        price: { $toDouble: { $ifNull: ["$cartItems.price", 0] } },
      },
    },

    // Join product → brand
    {
      $lookup: {
        from: "products",
        localField: "cartItems.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },

    {
      $lookup: {
        from: "brands",
        localField: "product.brandId",
        foreignField: "_id",
        as: "brand",
      },
    },
    { $unwind: "$brand" },

    // ✅ Group by brand
    {
      $group: {
        _id: "$brand._id",
        brand: { $first: "$brand.name" },
        qty: { $sum: "$qty" },
        revenue: { $sum: { $multiply: ["$qty", "$price"] } },
        orderIds: { $addToSet: "$_id" }, // collect order ids
      },
    },

    // ✅ Count orders
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
  console.log("⚠ brandSales error →", e.message);
  finalStats.brandSalesPerformance = [];
}

    //------------------------------------------------
    // 🔟 Payment Method Breakdown
    //------------------------------------------------
    const paymentDistRaw = await Order.aggregate([
      {
        $group: {
          _id: { $toLower: "$paymentMethod" },
          count: { $sum: 1 },
        },
      },
    ]);

    const normalized = {};
    paymentDistRaw.forEach((p) => {
      let key = p._id;
      if (key.includes("cod") || key.includes("cash")) key = "Cash on Delivery";
      else if (key.includes("stripe")) key = "Stripe";
      else key = key || "Unknown";
      normalized[key] = (normalized[key] || 0) + p.count;
    });

    finalStats.paymentMethodBreakdown = Object.entries(normalized).map(
      ([method, count]) => ({ method, count })
    );
 
    //------------------------------------------------
    // 11️⃣ Category Sales (by revenue)
    //------------------------------------------------
    try {
      const catAgg = await Order.aggregate([
        { $match: { [itemField]: { $exists: true, $ne: [] } } },
        { $unwind: `$${itemField}` },
        {
          $addFields: {
            _qty: { $toDouble: { $ifNull: [`$${itemField}.quantity`, 0] } },
            _price: { $toDouble: { $ifNull: [`$${itemField}.price`, 0] } },
          },
        },
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

      finalStats.categorySales = catAgg.map((c) => ({
        name: c?._id || "Unknown",
        value: c?.revenue || 0,
      }));
    } catch (err) {
      console.log("⚠ categorySales error →", err.message);
    }
   //------------------------------------------------
// ✅ Determine Best Brand + Best Category based on Buyers → Qty
//------------------------------------------------
try {
  if (finalStats.topProducts?.length > 0) {
    const brandMap = {};
    const categoryMap = {};

    for (const p of finalStats.topProducts) {
      const product = await Product.findById(p._id)
        .select("brandId categoryId")
        .populate("brandId", "name")
        .populate("categoryId", "name")
        .lean();

      if (!product) continue;

      const brandName = product.brandId?.name || "Unknown";
      const categoryName = product.categoryId?.name || "Unknown";

      // BRAND
      if (!brandMap[brandName]) {
        brandMap[brandName] = { buyers: 0, qty: 0 };
      }
      brandMap[brandName].buyers += p.buyers || 0;
      brandMap[brandName].qty += p.totalQty || 0;

      // CATEGORY
      if (!categoryMap[categoryName]) {
        categoryMap[categoryName] = { buyers: 0, qty: 0 };
      }
      categoryMap[categoryName].buyers += p.buyers || 0;
      categoryMap[categoryName].qty += p.totalQty || 0;
    }

    // ✅ Sort brand by buyers → qty
    const sortedBrands = Object.entries(brandMap)
      .sort((a, b) => {
        if (b[1].buyers !== a[1].buyers)
          return b[1].buyers - a[1].buyers;
        return b[1].qty - a[1].qty;
      });

    finalStats.bestSellingBrand = sortedBrands[0]?.[0] ?? null;

    // ✅ Sort category by buyers → qty
    const sortedCategories = Object.entries(categoryMap)
      .sort((a, b) => {
        if (b[1].buyers !== a[1].buyers)
          return b[1].buyers - a[1].buyers;
        return b[1].qty - a[1].qty;
      });

    finalStats.bestSellingCategory = sortedCategories[0]?.[0] ?? null;
  }
} catch (e) {
  console.log("⚠ best brand/category calc error →", e.message);
}
    //------------------------------------------------
    // ✅ Cache results
    //------------------------------------------------
    await AnalyticsCache.findOneAndUpdate(
      { key: CACHE_KEY },
      { data: finalStats, updatedAt: new Date() },
      { upsert: true }
    );
    console.log("✅ Dashboard stats computed & cached");

    return res.json({ success: true, data: finalStats });
  } catch (error) {
    console.error("getOrderStats ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch order stats" });
  }
};

//------------------------------------------------
// ✅ GET /admin/orders/sales-overview (Cached)
//------------------------------------------------
export const getSalesOverview = async (req, res) => {
  try {
    const CACHE_KEY = "admin:sales_overview";
    const CACHE_TTL_MS = 10 * 60 * 1000;

    const cache = await AnalyticsCache.findOne({ key: CACHE_KEY });
    if (cache && Date.now() - cache.updatedAt.getTime() < CACHE_TTL_MS) {
      console.log("📦 Sales overview served from Mongo cache");
      return res.json({ success: true, data: cache.data });
    }

    const now = new Date();
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const raw = await Order.aggregate([
      {
        $match: {
          $or: [
            { orderDate: { $gte: last30Days } },
            { createdAt: { $gte: last30Days } },
          ],
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

    await AnalyticsCache.findOneAndUpdate(
      { key: CACHE_KEY },
      { data: formatted, updatedAt: new Date() },
      { upsert: true }
    );
    console.log("✅ Sales overview cached");

    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("getSalesOverview ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch sales overview" });
  }
};
