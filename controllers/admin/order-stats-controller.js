// src/controllers/admin/order-stats-controller.js

import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";

// Get Order Statistics
export const getOrderStats = async (req, res) => {
  try {
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

    // Get basic counts
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: /pending/i });
    const deliveredOrders = await Order.countDocuments({ orderStatus: /delivered/i });
    const confirmedOrders = await Order.countDocuments({ orderStatus: /confirmed/i });
    const shippedOrders = await Order.countDocuments({ orderStatus: /shipped/i });

    // Get unique customers
    const customers = await Order.distinct("userId");
    const totalCustomers = customers.length;

    // Get low stock products
    const lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    // Get total revenue from delivered orders
    const revenueData = await Order.aggregate([
      { $match: { orderStatus: /delivered|confirmed/i } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    // Update stats
    finalStats.totalOrders = totalOrders;
    finalStats.pendingOrders = pendingOrders;
    finalStats.deliveredOrders = deliveredOrders;
    finalStats.confirmedOrders = confirmedOrders;
    finalStats.shippedOrders = shippedOrders;
    finalStats.totalCustomers = totalCustomers;
    finalStats.lowStock = lowStock;
    finalStats.totalRevenue = revenueData[0]?.total || 0;

    // Get Top 5 Products - Fixed version
    try {
  // First check what field contains the order items
  const sampleOrder = await Order.findOne({});
  let itemField = "cartItems";
  if (sampleOrder) {
    if (sampleOrder.cartItems && Array.isArray(sampleOrder.cartItems) && sampleOrder.cartItems.length > 0) {
      itemField = "cartItems";
    } else if (sampleOrder.items && Array.isArray(sampleOrder.items) && sampleOrder.items.length > 0) {
      itemField = "items";
    }
  }
  
  console.log("Using item field for products:", itemField);
  
  const topProducts = await Order.aggregate([
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
              {
                $toDouble: { 
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
                }
              }
            ] 
          } 
        }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 5 }
  ]);
  
  console.log("Top products result:", topProducts);
  finalStats.topProducts = topProducts;
} catch (e) {
  console.error("Top products error:", e);
  // Fallback to simpler aggregation
  try {
    const simpleTopProducts = await Order.aggregate([
      { $unwind: `$${itemField}` },
      {
        $group: {
          _id: `$${itemField}.productId`,
          title: { $first: `$${itemField}.title` },
          totalQty: { $sum: `$${itemField}.quantity` },
          revenue: { $sum: `$${itemField}.price` }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]);
    console.log("Simple top products result:", simpleTopProducts);
    finalStats.topProducts = simpleTopProducts;
  } catch (simpleError) {
    console.error("Simple top products error:", simpleError);
    finalStats.topProducts = [];
  }
}

    // Get Sales by Category - Top 5 only
try {
  // First check what field contains the order items
  const sampleOrder = await Order.findOne({});
  let itemField = "cartItems";
  if (sampleOrder) {
    if (sampleOrder.cartItems && Array.isArray(sampleOrder.cartItems) && sampleOrder.cartItems.length > 0) {
      itemField = "cartItems";
    } else if (sampleOrder.items && Array.isArray(sampleOrder.items) && sampleOrder.items.length > 0) {
      itemField = "items";
    }
  }
  
  console.log("Using item field for categories:", itemField);
  
  const categorySales = await Order.aggregate([
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
      $lookup: {
        from: "categories",
        localField: "product.categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: { $ifNull: ["$category.name", "Uncategorized"] },
        revenue: { $sum: { $multiply: [`$${itemField}.quantity`, `$${itemField}.price`] } },
        count: { $sum: 1 }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 5 } // Only get top 5 categories
  ]);
  
  console.log("Category sales result:", categorySales);
  
  // Format for chart
  const formattedCategorySales = categorySales.map(c => ({
    name: c._id,
    value: c.revenue
  }));
  
  finalStats.categorySales = formattedCategorySales;
} catch (e) {
  console.error("Category sales error:", e);
  finalStats.categorySales = [];
}

    res.json({ success: true, data: finalStats });
  } catch (error) {
    console.error("getOrderStats ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch order stats" });
  }
};

// Get Sales Overview
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
