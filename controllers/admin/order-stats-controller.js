// src/controllers/admin/order-stats-controller.js
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Brand from "../../models/Brand.js"; // ✅ brand support

//------------------------------------------------
// GET /admin/orders/stats
//------------------------------------------------
export const getOrderStats = async (req, res) => {
  try {
    const finalStats = {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      deliveredOrders: 0,
      totalCustomers: 0,
      revenueGrowthPercentage: 0,

      // ✅ NEW
      topCustomers: [],
      brandSales: [],
      paymentMethodBreakdown: [],
      cancelRate: 0,
      returnRate: 0,
      avgOrderValue: 0,
      repeatCustomers: 0,
      repeatCustomerRate: 0,

      // Old useful metrics
      lowStock: [],
      confirmedOrders: 0,
      shippedOrders: 0,
    };

    //------------------------------------------------
    // 1) Counts
    //------------------------------------------------
    const totalOrders = await Order.countDocuments();
    const deliveredOrders = await Order.countDocuments({
      orderStatus: /delivered|completed|shipped/i,
    });
    const pendingOrders = await Order.countDocuments({
      orderStatus: /pending|processing|confirmed/i,
    });
    const confirmedOrders = await Order.countDocuments({
      orderStatus: /confirmed/i,
    });
    const shippedOrders = await Order.countDocuments({
      orderStatus: /shipped/i,
    });

    finalStats.totalOrders = totalOrders;
    finalStats.deliveredOrders = deliveredOrders;
    finalStats.pendingOrders = pendingOrders;
    finalStats.confirmedOrders = confirmedOrders;
    finalStats.shippedOrders = shippedOrders;

    //------------------------------------------------
    // 2) Unique Customers
    //------------------------------------------------
    const uniqueCustomers = await Order.distinct("userId");
    finalStats.totalCustomers = uniqueCustomers.length;

    //------------------------------------------------
    // 3) Low Stock Products
    //------------------------------------------------
    finalStats.lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    //------------------------------------------------
    // 4) Revenue + AOV
    //------------------------------------------------
    const revenueAgg = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const revenue = revenueAgg[0]?.total ?? 0;
    finalStats.totalRevenue = revenue;
    finalStats.avgOrderValue =
      totalOrders > 0 ? Number((revenue / totalOrders).toFixed(2)) : 0;

    //------------------------------------------------
    // 5) Repeat Customers
    //------------------------------------------------
    const customerOrderCount = await Order.aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]);

    const repeatUsers = customerOrderCount.filter((u) => u.count > 1).length;
    finalStats.repeatCustomers = repeatUsers;
    finalStats.repeatCustomerRate =
      uniqueCustomers.length > 0
        ? Number(((repeatUsers / uniqueCustomers.length) * 100).toFixed(2))
        : 0;

    //------------------------------------------------
    // 6) Return + Cancellation Rate
    //------------------------------------------------
    const cancelled = await Order.countDocuments({ orderStatus: /cancel/i });
    const returned = await Order.countDocuments({ orderStatus: /return/i });

    finalStats.cancelRate =
      totalOrders > 0 ? Number(((cancelled / totalOrders) * 100).toFixed(2)) : 0;

    finalStats.returnRate =
      totalOrders > 0 ? Number(((returned / totalOrders) * 100).toFixed(2)) : 0;

    //------------------------------------------------
    // 7) Top Customers (Lifetime revenue)
    //------------------------------------------------
    const topCustomers = await Order.aggregate([
      {
        $group: {
          _id: "$userId",
          orders: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          userName: "$user.userName",
          orders: 1,
          totalSpent: 1,
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
    ]);
    finalStats.topCustomers = topCustomers;

    //------------------------------------------------
    // 8) Brand Sales Performance
    //------------------------------------------------
    const brandSales = await Order.aggregate([
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
          _id: "$brand.name",
          revenue: {
            $sum: {
              $multiply: ["$cartItems.quantity", "$cartItems.price"],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    finalStats.brandSales = brandSales.map((b) => ({
      brand: b._id,
      revenue: b.revenue,
    }));

    //------------------------------------------------
    // 9) Payment Method Distribution
    //------------------------------------------------
    const paymentDist = await Order.aggregate([
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
        },
      },
    ]);

    finalStats.paymentMethodBreakdown = paymentDist.map((p) => ({
      method: p._id,
      count: p.count,
    }));

    //------------------------------------------------
    // FINISH
    //------------------------------------------------
    res.json({ success: true, data: finalStats });
  } catch (error) {
    console.error("getOrderStats ERROR:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch order stats" });
  }
};

//------------------------------------------------
// GET /admin/orders/sales-overview
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

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("getSalesOverview ERROR:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch sales overview" });
  }
};
