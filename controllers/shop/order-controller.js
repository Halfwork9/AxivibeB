// ✅ controllers/shop/order-controller.js
import Stripe from "stripe";
import Order from "../../models/Order.js";
import Cart from "../../models/Cart.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";

// ✅ Email
import { sendEmail } from "../../src/utils/sendEmail.js";
import { orderPlacedTemplate } from "../../src/templates/orderPlacedTemplate.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-01-27.acacia",
});

/**
 * ✅ CREATE ORDER
 * COD → Confirm immediately + email customer
 * Stripe → Create pending order → verify via webhook
 */
export const createOrder = async (req, res) => {
  try {
    const {
      userId,
      cartId,
      cartItems,
      addressInfo,
      totalAmount,
      paymentMethod
    } = req.body;

    const user = await User.findById(userId).select("userName email");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ✅ Add brandId + categoryId to cart items
    for (let item of cartItems) {
      const product = await Product.findById(item.productId).select("brandId categoryId");
      item.brandId = product?.brandId ?? null;
      item.categoryId = product?.categoryId ?? null;
    }

    // ✅ CASH ON DELIVERY
    if (paymentMethod === "cod") {
      const newOrder = new Order({
        userId,
        userName: user?.userName,
        userEmail: user?.email,
        cartId,
        cartItems,
        addressInfo,
        totalAmount,
        paymentMethod: "cod",
        paymentStatus: "pending",
        orderStatus: "confirmed",
        orderDate: new Date(),
        orderUpdateDate: new Date(),
      });

      // ✅ Decrease stock
      for (let item of cartItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { totalStock: -item.quantity },
        });
      }

      await Cart.findByIdAndDelete(cartId);
      const savedOrder = await newOrder.save();

      // ✅ Send order email
      try {
        await sendEmail({
          to: user.email,
          subject: "Order Placed",
          html: orderPlacedTemplate(user.userName, savedOrder),
        });
      } catch (err) {
        console.log("⚠ Email send failed:", err.message);
      }

      return res.status(201).json({
        success: true,
        message: "Order placed successfully",
        data: savedOrder,
      });
    }

    // ✅ STRIPE
    if (paymentMethod === "stripe") {
      const newOrder = new Order({
        userId,
        userName: user?.userName,
        userEmail: user?.email,
        cartId,
        cartItems,
        addressInfo,
        orderStatus: "pending",
        paymentMethod: "stripe",
        paymentStatus: "pending",
        totalAmount,
        orderDate: new Date(),
        orderUpdateDate: new Date(),
      });

      await newOrder.save();

      // ✅ Create Stripe Session
      let session;
      try {
        session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",

          line_items: cartItems.map((item) => ({
            price_data: {
              currency: "inr",
              product_data: {
                name: item.title,
                images: [item.image],
              },
              unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
          })),

          success_url: `${process.env.FRONTEND_URL}/shop/payment-success?orderId=${newOrder._id}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.FRONTEND_URL}/shop/payment-cancel`,

          metadata: { orderId: newOrder._id.toString() },
        });
      } catch (err) {
        console.log("STRIPE SESSION ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
      }

      return res.status(200).json({ success: true, url: session.url });
    }

    return res.status(400).json({ success: false, message: "Invalid payment method" });
  } catch (error) {
    console.error("createOrder ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ WEBHOOK → Stripe confirms payment
 * MUST be raw body in server.js
 */
export const stripeWebhook = async (req, res) => {
  let event;

  try {
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.sendStatus(400);
  }
  
 console.log("🔥 Stripe webhook hit:", event.type);
 console.log("📌 Full event:", JSON.stringify(event, null, 2));
  
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata.orderId;

    try {
      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (order.paymentStatus === "paid") {
        return res.json({ received: true }); // ignore duplicate
      }

      order.paymentStatus = "paid";
      order.orderStatus = "confirmed";
      order.paymentId = session.payment_intent;
      order.orderUpdateDate = new Date();

      // ✅ Decrease stock
      for (const item of order.cartItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { totalStock: -item.quantity },
        });
      }

      await Cart.findByIdAndDelete(order.cartId);
      await order.save();

      // ✅ Send confirmation email
      try {
  await sendEmail({
    to: order.userEmail,
    subject: "Order Confirmed",
    html: orderPlacedTemplate(order.userName, order),
  });
} catch (err) {
  console.log("⚠ Email failed:", err.message);
}

      console.log(`✅ Order ${orderId} confirmed`);
    } catch (error) {
      console.error("Webhook handler ERROR:", error);
    }
  }

  res.json({ received: true });
};


export const verifyStripePayment = async (req, res) => {
  try {
    const { orderId, session_id } = req.body;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID is required" });
    }

    let order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // ✅ Already Verified → return
    if (order.paymentStatus === "paid") {
      return res.json({
        success: true,
        data: order,
        message: "Already verified",
      });
    }

    if (order.paymentMethod !== "stripe") {
      return res.json({
        success: true,
        data: order,
        message: "Not a Stripe order",
      });
    }

    // ✅ Get stored or received session_id
    const stripeSessionId = session_id || order.paymentId;
    if (!stripeSessionId) {
      return res.status(400).json({
        success: false,
        message: "Missing Stripe Session ID",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

    if (session.payment_status === "paid") {
      // ✅ Update order only (NO EMAIL, NO STOCK)
      order.paymentStatus = "paid";
      order.orderStatus = "confirmed";
      order.paymentId = stripeSessionId;
      order.orderUpdateDate = new Date();

      await order.save();

      return res.json({
        success: true,
        data: order,
        message: "Payment verified",
      });
    }

    return res.json({
      success: false,
      message: "Not paid yet",
      data: order,
    });
  } catch (error) {
    console.error("verifyStripePayment ERROR:", error);
    return res
      .status(500)
      .json({ success: false, message: "Stripe verification failed" });
  }
};



//  Get orders for a user
export const getAllOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId });
    res.status(200).json({ success: true, data: orders });
  } catch (e) {
    res.status(500).json({ success: false, message: "Error fetching orders" });
  }
};

//  Get single order
export const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found!" });
    }

    res.status(200).json({ success: true, data: order });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Some error occurred!" });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success:false, message:"Order not found" });

    // ✅ restrict
    if (["delivered", "returned", "cancelled"].includes(order.orderStatus)) {
      return res.status(400).json({ success:false, message:"Order cannot be cancelled" });
    }

    // ✅ restore stock
    for (const item of order.cartItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { totalStock: item.quantity },
      });
    }

    order.orderStatus = "cancelled";
    order.orderUpdateDate = new Date();
    await order.save();

    return res.json({ success:true, message:"Order cancelled successfully", data: order });

  } catch (error) {
    console.error("Cancel Order Error => ", error);
    return res.status(500).json({ success:false, message:"Failed to cancel order" });
  }
};

export const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success:false, message:"Order not found" });

    // ✅ allowed only when delivered
    if (order.orderStatus !== "delivered") {
      return res.status(400).json({ success:false, message:"Return request not allowed" });
    }

    // ✅ stock reversal
    for (const item of order.cartItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { totalStock: item.quantity },
      });
    }

    order.orderStatus = "returned";
    order.orderUpdateDate = new Date();
    await order.save();

    return res.json({ success:true, message:"Order returned successfully", data: order });

  } catch (error) {
    console.error("Return Order Error => ", error);
    return res.status(500).json({ success:false, message:"Failed to return order" });
  }
};
 
