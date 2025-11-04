// controllers/admin/order-controller.js
import Order from "../../models/Order.js";

export const getAllOrdersOfAllUsers = async (req, res) => {
  try {
    const { sortBy = "date-desc", page = 1, limit = 10 } = req.query;
    
    let sortQuery = {};
    switch (sortBy) {
      case "date-desc":
        sortQuery = { orderDate: -1 };
        break;
      case "date-asc":
        sortQuery = { orderDate: 1 };
        break;
      case "amount-desc":
        sortQuery = { totalAmount: -1 };
        break;
      case "amount-asc":
        sortQuery = { totalAmount: 1 };
        break;
      case "status":
        sortQuery = { orderStatus: 1 };
        break;
      default:
        sortQuery = { orderDate: -1 };
    }

    const skip = (page - 1) * limit;
    
    const orders = await Order.find({})
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .populate({
        path: "userId",
        select: "userName email"
      });

    const totalOrders = await Order.countDocuments();

    if (!orders.length) {
      return res.status(404).json({ 
        success: false, 
        message: "No orders found!" 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasNext: page * limit < totalOrders,
        hasPrev: page > 1
      }
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occurred!" });
  }
};

export const getOrderDetailsForAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id)
      .populate({
        path: "userId",
        select: "userName email"
      });
    
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found!" });
    }
    
    res.status(200).json({ success: true, data: order });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occurred!" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;
    
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found!" });
    }
    
    const updatedOrder = await Order.findByIdAndUpdate(
      id, 
      { 
        orderStatus,
        orderUpdateDate: new Date()
      }, 
      { new: true }
    );
    
    res.status(200).json({ 
      success: true, 
      message: "Order status updated successfully!",
      data: updatedOrder
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occurred!" });
  }
};

// ✅ NEW: Add the updatePaymentStatus function
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    // Validate the new status
    const allowedStatuses = ['paid', 'pending', 'failed', 'refunded'];
    if (!allowedStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status provided.",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Optional: Add a business logic check
    // For example, only allow marking as 'paid' if it was a COD order and is already delivered.
    if (order.paymentMethod !== 'Cash on Delivery') {
      return res.status(400).json({
        success: false,
        message: "This action is only applicable for Cash on Delivery orders.",
      });
    }

    order.paymentStatus = paymentStatus;
    await order.save();

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${paymentStatus}.`,
      data: order, // Send back the updated order
    });

  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment status.",
    });
  }
};

// Add this to your admin order controller

export const debugOrderStatuses = async (req, res) => {
  try {
    const orders = await Order.find({});
    const statusCounts = {};
    const paymentStatusCounts = {};
    
    orders.forEach(order => {
      const status = order.orderStatus;
      const paymentStatus = order.paymentStatus;
      
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      paymentStatusCounts[paymentStatus] = (paymentStatusCounts[paymentStatus] || 0) + 1;
    });
    
    res.json({ 
      success: true, 
      data: {
        totalOrders: orders.length,
        statusCounts,
        paymentStatusCounts,
        sampleOrders: orders.map(o => ({
          id: o._id,
          status: o.orderStatus,
          paymentStatus: o.paymentStatus,
          date: o.orderDate || o.createdAt
        }))
      }
    });
  } catch (error) {
    console.error("Debug order statuses error:", error);
    res.status(500).json({ success: false, message: "Failed to debug order statuses" });
  }
};
