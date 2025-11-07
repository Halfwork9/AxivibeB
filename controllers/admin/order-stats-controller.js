// src/controllers/admin/order-stats-controller.js
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";

export const getOrderStats = async (req, res) => {
  try {
    const stats = {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      deliveredOrders: 0,
      totalCustomers: 0,
      topProducts: [],
      categorySales: [],
      lowStock: [],
      confirmedOrders: 0,
      shippedOrders: 0,
    };

    // 1. Fetch all orders
    const orders = await Order.find({}).lean();

    // 2. Basic Counts
    stats.totalOrders = orders.length;
    stats.totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    stats.pendingOrders = orders.filter(o => /pending|processing/i.test(o.orderStatus)).length;
    stats.deliveredOrders = orders.filter(o => /delivered|completed/i.test(o.orderStatus)).length;
    stats.confirmedOrders = orders.filter(o => /confirmed/i.test(o.orderStatus)).length;
    stats.shippedOrders = orders.filter(o => /shipped/i.test(o.orderStatus)).length;
    stats.totalCustomers = new Set(orders.map(o => o.userId?.toString())).size;

    // 3. Low Stock
    stats.lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    // 4. Top 5 Products
    const topProducts = await Order.aggregate([
      { $match: { "cartItems.0": { $exists: true } } },
      { $unwind: "$cartItems" },
      { $addFields: { "cartItems.productId": { $toObjectId: "$cartItems.productId" } } },
      {
        $lookup: {
          from: "products",
          localField: "cartItems.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$cartItems.productId",
          title: { $first: { $ifNull: ["$product.title", "$cartItems.title"] } },
          totalQty: { $sum: "$cartItems.quantity" },
          revenue: { $sum: { $multiply: ["$cartItems.quantity", "$cartItems.price"] } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]);
    stats.topProducts = topProducts;

    // 5. Sales by Category
    const categorySales = await Order.aggregate([
      { $match: { "cartItems.0": { $exists: true } } },
      { $unwind: "$cartItems" },
      { $addFields: { "cartItems.productId": { $toObjectId: "$cartItems.productId" } } },
      {
        $lookup: {
          from: "products",
          localField: "cartItems.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      { $addFields: { "product.categoryId": { $toObjectId: "$product.categoryId" } } },
      {
        $lookup: {
          from: "categories",
          localField: "product.categoryId",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$category.name", "Uncategorized"] },
          value: { $sum: { $multiply: ["$cartItems.quantity", "$cartItems.price"] } }
        }
      },
      { $sort: { value: -1 } }
    ]);
    stats.categorySales = categorySales.filter(c => c.value > 0);

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("getOrderStats ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
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
