// src/controllers/admin/order-stats-controller.js
import mongoose from "mongoose";
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Brand from "../../models/Brand.js";
import User from "../../models/User.js";

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
// GET /admin/orders/stats
//------------------------------------------------
export const getOrderStats = async (req, res) => {
  try {
    const finalStats = {
      // Core KPIs
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      deliveredOrders: 0,
      totalCustomers: 0,
      revenueGrowthPercentage: 0, // (left 0 unless you want month-over-month calc)

      // New analytics
      topCustomers: [],                // [{ userId, name, email, totalSpent, orderCount }]
      brandSales: [],                  // [{ brand, revenue, qty }]
      paymentMethodBreakdown: [],      // [{ method, count }]
      cancelRate: 0,                   // %
      returnRate: 0,                   // %
      avgOrderValue: 0,                // number
      repeatCustomers: 0,
      repeatCustomerRate: 0,           // %

      // Still useful
      lowStock: [],                    // [{ _id, title, totalStock }]
      confirmedOrders: 0,
      shippedOrders: 0,

      // Legacy charts people still like
      topProducts: [],                 // [{ _id, title, image, totalQty, revenue }]
      categorySales: [],               // [{ name, value }]
    };

    // Detect items field
    const itemField = await detectItemField();

    //------------------------------------------------
    // 1) Basic counts
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
    // 2) Low stock
    //------------------------------------------------
    try {
      finalStats.lowStock = await Product.find({ totalStock: { $lt: 10 } })
        .select("title totalStock")
        .limit(5)
        .lean();
    } catch {}

    //------------------------------------------------
    // 3) Revenue & AOV (lifetime)
    //------------------------------------------------
    try {
      const revenueAgg = await Order.aggregate([
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]);
      const revenue = revenueAgg[0]?.total ?? 0;
      finalStats.totalRevenue = revenue;
      finalStats.avgOrderValue =
        totalOrders > 0 ? Number((revenue / totalOrders).toFixed(2)) : 0;
    } catch {}

    //------------------------------------------------
    // 4) Repeat Customers
    //------------------------------------------------
    try {
      const customerOrderCount = await Order.aggregate([
        { $group: { _id: "$userId", count: { $sum: 1 } } },
      ]);
      const repeatUsers = customerOrderCount.filter((u) => (u?.count || 0) > 1).length;
      finalStats.repeatCustomers = repeatUsers;
      finalStats.repeatCustomerRate =
        uniqueCustomers.length > 0
          ? Number(((repeatUsers / uniqueCustomers.length) * 100).toFixed(2))
          : 0;
    } catch {}

    //------------------------------------------------
    // 5) Cancellation & Return rates
    //------------------------------------------------
    try {
      const [cancelled, returned] = await Promise.all([
        Order.countDocuments({ orderStatus: /cancel/i }),
        Order.countDocuments({ orderStatus: /return/i }),
      ]);
      finalStats.cancelRate =
        totalOrders > 0 ? Number(((cancelled / totalOrders) * 100).toFixed(2)) : 0;
      finalStats.returnRate =
        totalOrders > 0 ? Number(((returned / totalOrders) * 100).toFixed(2)) : 0;
    } catch {}

    //------------------------------------------------
    // 6) Top Customers (lifetime)
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
    // 7) Brand Sales Performance (lifetime)
    //------------------------------------------------
// ✅ BRAND SALES (Lifetime Top 5)
const brandAgg = await Order.aggregate([
  { $unwind: "$cartItems" },

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
    $group: {
      _id: "$product.brandId",
      qty: { $sum: "$cartItems.quantity" },
      orderCount: { $addToSet: "$_id" }, // ✅ collect distinct orders
      revenue: {
        $sum: {
          $multiply: ["$cartItems.quantity", "$cartItems.price"],
        },
      },
    },
  },
  {
    $project: {
      qty: 1,
      revenue: 1,
      orderCount: { $size: "$orderCount" }, // ✅ size of distinct orders
    },
  },
  { $sort: { orderCount: -1 } },   // ✅ Top lifetime brands
  { $limit: 5 },
]);

// ✅ Hydrate brand names
const brands = await Promise.all(
  brandAgg.map(async (b) => {
    const brand = await Brand.findById(b._id).select("name");
    return {
      _id: b._id,
      brand: brand?.name || "Unknown",
      qty: b.qty,
      revenue: b.revenue,
      orderCount: b.orderCount,
    };
  })
);

finalStats.brandSalesPerformance = brands;

    //------------------------------------------------
    // 8) Payment Method Distribution (lifetime)
    //------------------------------------------------
    try {
      const paymentDist = await Order.aggregate([
        {
          $group: {
            _id: "$paymentMethod",
            count: { $sum: 1 },
          },
        },
      ]);
      finalStats.paymentMethodBreakdown = paymentDist.map((p) => ({
        method: p?._id || "Unknown",
        count: p?.count || 0,
      }));
    } catch {}

    //------------------------------------------------
    // 9) Top Products (lifetime)
    //------------------------------------------------
    try {
      const topProductsAgg = await Order.aggregate([
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
          $group: {
            _id: "$product._id",
            title: { $first: "$product.title" },
            image: { $first: { $arrayElemAt: ["$product.images", 0] } },
            totalQty: { $sum: "$_qty" },
            revenue: { $sum: { $multiply: ["$_qty", "$_price"] } },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]);
      finalStats.topProducts = topProductsAgg;
    } catch {}

    //------------------------------------------------
    // 10) Top Categories by Revenue (lifetime)
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
    } catch {}

    //------------------------------------------------
    // DONE
    //------------------------------------------------
    return res.json({ success: true, data: finalStats });
  } catch (error) {
    console.error("getOrderStats ERROR:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch order stats" });
  }
};

//------------------------------------------------
// GET /admin/orders/sales-overview  (30-day line chart)
//------------------------------------------------
export const getSalesOverview = async (req, res) => {
  try {
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

    const formatted = raw.map((d) => ({
      date: `${d._id.day}/${d._id.month}`,
      revenue: d.revenue,
      orders: d.orders,
    }));

    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("getSalesOverview ERROR:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch sales overview" });
  }
};
