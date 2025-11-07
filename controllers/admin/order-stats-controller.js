import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";

// Helper function to calculate stats
const getStatsWithChange = async (model, filter = {}, prevFilter = {}) => {
  const current = await model.countDocuments(filter);
  const previous = await model.countDocuments(prevFilter);
  const change = current - previous;
  const percentage = previous > 0 ? (change / previous) * 100 : (current > 0 ? 100 : 0);
  return { value: current, change: { value: change, percentage: percentage.toFixed(0) } };
};

export const getOrderStats = async (req, res) => {
  try {
    console.log("=== Starting getOrderStats ===");

    // --- Basic Stats ---
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: /pending/i });
    const deliveredOrders = await Order.countDocuments({ orderStatus: /delivered/i });
    const confirmedOrders = await Order.countDocuments({ orderStatus: /confirmed/i });
    const shippedOrders = await Order.countDocuments({ orderStatus: /shipped/i });
    const customers = await Order.distinct("userId");
    const totalCustomers = customers.length;
    
    const lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    const revenueData = await Order.aggregate([
      { $match: { orderStatus: { $in: [/delivered/i, /confirmed/i] } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const totalRevenue = revenueData[0]?.total || 0;

    // ✅ --- NEW: Efficient Top 5 Products ---
    // This single query calculates revenue for all products from completed orders.
    const topProducts = await Order.aggregate([
      { $match: { orderStatus: { $in: [/delivered/i, /confirmed/i] } } },
      { $project: {
          orderItems: { $concatArrays: [ { $ifNull: ["$cartItems", []] }, { $ifNull: ["$items", []] } ] }
      }},
      { $unwind: "$orderItems" },
      { $group: {
          _id: "$orderItems.productId",
          totalQty: { $sum: "$orderItems.quantity" },
          revenue: { $sum: { $multiply: ["$orderItems.quantity", "$orderItems.price"] } }
      }},
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
      }},
      { $unwind: "$productDetails" },
      { $project: {
          _id: 1,
          title: "$productDetails.title",
          totalQty: 1,
          revenue: 1
      }}
    ]);

    // ✅ --- NEW: Efficient Top 5 Categories ---
    // This single query calculates revenue for all categories from completed orders.
    const categorySales = await Order.aggregate([
      { $match: { orderStatus: { $in: [/delivered/i, /confirmed/i] } } },
      { $project: {
          orderItems: { $concatArrays: [ { $ifNull: ["$cartItems", []] }, { $ifNull: ["$items", []] } ] }
      }},
      { $unwind: "$orderItems" },
      { $group: {
          _id: "$orderItems.productId",
          revenue: { $sum: { $multiply: ["$orderItems.quantity", "$orderItems.price"] } }
      }},
      { $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
      }},
      { $unwind: "$productDetails" },
      { $group: {
          _id: "$productDetails.categoryId",
          value: { $sum: "$revenue" } // 'value' for the pie chart
      }},
      { $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryDetails"
      }},
      { $unwind: "$categoryDetails" },
      { $sort: { value: -1 } },
      { $limit: 5 },
      { $project: {
          name: "$categoryDetails.name",
          value: 1
      }}
    ]);

    console.log("Final Top Products:", topProducts);
    console.log("Final Category Sales:", categorySales);

    // --- Final Stats Object ---
    const finalStats = {
      totalOrders,
      pendingOrders,
      deliveredOrders,
      confirmedOrders,
      shippedOrders,
      totalCustomers,
      lowStock,
      totalRevenue,
      topProducts: topProducts.length > 0 ? topProducts : [], // Use query result or empty
      categorySales: categorySales.length > 0 ? categorySales : [], // Use query result or empty
    };

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

// Debug endpoint to check data structure
export const debugDataStructure = async (req, res) => {
  try {
    // Get sample order
    const sampleOrder = await Order.findOne({});
    
    // Get orders with items
    const orders = await Order.find({}).limit(2);
    
    // Get products
    const products = await Product.find({}).limit(2);
    
    // Get categories
    const categories = await Category.find({}).limit(2);
    
    // Check order items structure
    const orderItems = await Order.aggregate([
      { $limit: 2 },
      { $project: { cartItems: 1, items: 1 } }
    ]);
    
    // Check if products have categoryId
    const productsWithCategory = await Product.find({ categoryId: { $exists: true } }).limit(2);
    
    res.json({ 
      success: true, 
      data: {
        sampleOrder,
        orders,
        products,
        categories,
        orderItems,
        productsWithCategory
      }
    });
  } catch (error) {
    console.error("Debug data structure error:", error);
    res.status(500).json({ success: false, message: "Failed to debug data structure" });
  }
};
