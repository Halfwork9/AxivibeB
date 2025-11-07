import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";

export const getOrderStats = async (req, res) => {
  try {
    console.log("=== getOrderStats ===");

    const finalStats = {
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

    // =========================
    // ✅ BASIC NUMBERS
    // =========================
    finalStats.totalOrders = await Order.countDocuments();
    finalStats.pendingOrders = await Order.countDocuments({ orderStatus: /pending/i });
    finalStats.deliveredOrders = await Order.countDocuments({ orderStatus: /delivered/i });
    finalStats.confirmedOrders = await Order.countDocuments({ orderStatus: /confirmed/i });
    finalStats.shippedOrders = await Order.countDocuments({ orderStatus: /shipped/i });

    const customers = await Order.distinct("userId");
    finalStats.totalCustomers = customers.length;

    // Low stock warning
    finalStats.lowStock = await Product.find({ totalStock: { $lt: 10 } })
      .select("title totalStock")
      .limit(5)
      .lean();

    // Revenue
    const revenueAgg = await Order.aggregate([
      { $match: { cartItems: { $exists: true, $ne: [] } } },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    finalStats.totalRevenue = revenueAgg?.[0]?.total ?? 0;

    // =========================
    // ✅ TOP PRODUCTS — LIFETIME
    // =========================
   const topProductsAgg = await Order.aggregate([
  { $match: { cartItems: { $exists: true, $ne: [] } } },
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
      _id: "$cartItems.productId",
      title: { $first: "$product.title" },
      image: { $first: { $arrayElemAt: ["$product.images", 0] } },
      totalQty: { $sum: "$cartItems.quantity" },
      revenue: {
        $sum: {
          $multiply: ["$cartItems.quantity", "$cartItems.price"],
        },
      },
    },
  },
  { $sort: { revenue: -1 } },
  { $limit: 5 },
]);
finalStats.topProducts = topProductsAgg;


    // =========================
    // ✅ TOP CATEGORIES — LIFETIME
    // =========================
  const categoryAgg = await Order.aggregate([
  { $match: { cartItems: { $exists: true, $ne: [] } } },
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
      revenue: {
        $sum: {
          $multiply: ["$cartItems.quantity", "$cartItems.price"],
        },
      },
    },
  },
  { $sort: { revenue: -1 } },
  { $limit: 5 },
]);
finalStats.categorySales = categoryAgg;


    console.log("✅ Final Stats Ready");
    res.json({ success: true, data: finalStats });
  } catch (error) {
    console.error("❌ getOrderStats ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order stats",
    });
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
