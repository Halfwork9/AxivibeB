// src/controllers/admin/order-stats-controller.js
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import mongoose from "mongoose";

export const getOrderStats = async (req, res) => {
  try {
    console.log("=== Starting getOrderStats ===");

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

    // ===== BASIC METRICS =====
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
      { $match: { orderStatus: { $in: ["delivered", "confirmed"] } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    finalStats.totalOrders = totalOrders;
    finalStats.pendingOrders = pendingOrders;
    finalStats.deliveredOrders = deliveredOrders;
    finalStats.confirmedOrders = confirmedOrders;
    finalStats.shippedOrders = shippedOrders;
    finalStats.totalCustomers = totalCustomers;
    finalStats.lowStock = lowStock;
    finalStats.totalRevenue = revenueData[0]?.total || 0;

// ===== TOP PRODUCTS by revenue =====
const topProducts = await Order.aggregate([
  // ✅ Only consider orders that were actually completed
  {
    $match: {
      orderStatus: { $in: ["delivered", "confirmed"] }
    }
  },

  { $unwind: "$cartItems" },

  {
    $group: {
      _id: "$cartItems.productId",
      totalQty: { $sum: { $toDouble: "$cartItems.quantity" } },
      revenue: {
        $sum: {
          $multiply: [
            { $toDouble: "$cartItems.quantity" },
            { $toDouble: "$cartItems.price" }
          ]
        }
      }
    }
  },

  {
    $lookup: {
      from: "products",
      localField: "_id",
      foreignField: "_id",
      as: "product"
    }
  },
  { $unwind: "$product" },

  {
    $project: {
      _id: 1,
      title: "$product.title",
      totalQty: 1,
      revenue: 1,
    }
  },
  { $sort: { revenue: -1 } },
  { $limit: 5 }
]);

finalStats.topProducts = topProducts;


// ===== CATEGORY SALES (top 5) =====
const categorySales = await Order.aggregate([
  {
    $match: {
      orderStatus: { $in: ["delivered", "confirmed"] }   // ✅ keep only valid orders
    }
  },

  { $unwind: "$cartItems" },   // break each order item

  // Group revenue + qty by productId
  {
    $group: {
      _id: "$cartItems.productId",
      totalQty: { $sum: { $toDouble: { $ifNull: ["$cartItems.quantity", 0] } } },
      revenue: {
        $sum: {
          $multiply: [
            { $toDouble: { $ifNull: ["$cartItems.quantity", 0] } },
            { $toDouble: { $ifNull: ["$cartItems.price", 0] } }
          ]
        }
      }
    }
  },

  // Join with products collection → get category
  {
    $lookup: {
      from: "products",
      localField: "_id",
      foreignField: "_id",
      as: "product"
    }
  },
  { $unwind: "$product" },

  // Group by category
  {
    $group: {
      _id: "$product.categoryId",
      totalRevenue: { $sum: "$revenue" },
      totalQty: { $sum: "$totalQty" },
      products: { $push: "$product.title" }     // optional → shows product list
    }
  },

  // Join category name
  {
    $lookup: {
      from: "categories",
      localField: "_id",
      foreignField: "_id",
      as: "category"
    }
  },
  { $unwind: "$category" },

  {
    $project: {
      _id: 0,
      categoryId: "$_id",
      name: "$category.name",
      totalRevenue: 1,
      totalQty: 1,
      products: 1   // optional → list of product names inside category
    }
  },

  { $sort: { totalRevenue: -1 } },
  { $limit: 5 }
]);

finalStats.categorySales = categorySales;



    console.log("✅ FINAL STATS SENT");
    res.json({ success: true, data: finalStats });

  } catch (error) {
    console.error("❌ getOrderStats ERROR:", error);
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
    
    // Check order statuses
    const orderStatuses = await Order.distinct("orderStatus");
    
    // Check if we have any orders with cartItems
    const ordersWithItems = await Order.find({ 
      cartItems: { $exists: true, $ne: [] }
    }).limit(3);
    
    // Check data types in cartItems
    let cartItemDataTypes = null;
    if (ordersWithItems.length > 0 && ordersWithItems[0].cartItems.length > 0) {
      const item = ordersWithItems[0].cartItems[0];
      cartItemDataTypes = {
        price: typeof item.price,
        quantity: typeof item.quantity,
        priceValue: item.price,
        quantityValue: item.quantity
      };
    }
    
    // Check if the Nikon product exists and has a categoryId
    const nikonProduct = await Product.findById("68b568edb142b6c4967cb6fb");
    
    res.json({ 
      success: true, 
      data: {
        sampleOrder,
        orders,
        products,
        categories,
        orderItems,
        productsWithCategory,
        orderStatuses,
        ordersWithItems,
        cartItemDataTypes,
        nikonProduct
      }
    });
  } catch (error) {
    console.error("Debug data structure error:", error);
    res.status(500).json({ success: false, message: "Failed to debug data structure" });
  }
};
