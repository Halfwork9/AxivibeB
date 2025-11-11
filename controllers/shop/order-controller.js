//  controllers/shop/order-controller.js
import Stripe from "stripe";
import Order from "../../models/Order.js";
import Cart from "../../models/Cart.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";
import { sendEmail } from "../../src/utils/sendEmail.js";
import { orderPlacedTemplate } from "../../src/templates/orderPlacedTemplate.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-01-27.acacia",
});

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

    //  Inject brandId + categoryId inside each cartItem
    for (let item of cartItems) {
      const product = await Product.findById(item.productId).select(
        "brandId categoryId"
      );
      item.brandId = product?.brandId ?? null;
      item.categoryId = product?.categoryId ?? null;
    }

    //  COD ORDER
    if (paymentMethod === "cod") {
      const newOrder = new Order({
        userId,
        userName: user?.userName ?? "",
        userEmail: user?.email ?? "",
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

      //  Decrease stock
      for (let item of cartItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { totalStock: -item.quantity },
        });
      }

      await Cart.findByIdAndDelete(cartId);
      const savedOrder = await newOrder.save();

      //  Email Customer
      sendEmail({
      to: user.email,
      subject: "Order Placed Successfully",
      html: orderPlacedTemplate(user.userName, savedOrder),
      });


      return res.status(201).json({
        success: true,
        message: "Order placed successfully!",
        data: savedOrder,
      });
    }

    //  STRIPE ORDER
    if (paymentMethod === "stripe") {
      const newOrder = new Order({
        userId,
        userName: user?.userName ?? "",
        userEmail: user?.email ?? "",
        cartId,
        cartItems,
        addressInfo,

        //  TEMP CONFIRM immediately
        orderStatus: "confirmed",
        paymentMethod: "stripe",
        paymentStatus: "pending",

        totalAmount,
        orderDate: new Date(),
        orderUpdateDate: new Date(),
      });

      await newOrder.save();

      const session = await stripe.checkout.sessions.create({
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

        //  Must include session_id
        success_url: `https://nikhilmamdekar.site/shop/payment-success?orderId=${newOrder._id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://nikhilmamdekar.site/shop/payment-cancel`,

        metadata: { orderId: newOrder._id.toString() },
      });

      return res.status(200).json({ success: true, url: session.url });
    }

    return res.status(400).json({ success: false, message: "Invalid payment method." });
  } catch (error) {
    console.error("Error in createOrder:", error);
    res.status(500).json({ success: false, message: "Error creating order" });
  }
};


//  Webhook to confirm payment (No changes needed here)
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
    console.error("❌ Stripe webhook signature error:", err.message);
    return res.sendStatus(400);
  }

  console.log(`✅ Stripe Event Received: ${event.type}`);

  // ✅ Handle only checkout complete
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;

    console.log("🔎 orderId from metadata →", orderId);

    if (!orderId) {
      console.error("❌ Missing orderId in session metadata.");
      return res.status(200).json({ received: true });
    }

    try {
      const order = await Order.findById(orderId);

      if (!order) {
        console.error("❌ Order not found for:", orderId);
        return res.status(200).json({ received: true }); // still acknowledge
      }

      // ✅ If already marked paid → skip
      if (order.paymentStatus === "paid") {
        console.log("ℹ️ Order already paid, skipping");
        return res.status(200).json({ received: true });
      }

      // ✅ Update fields
      order.paymentStatus = "paid";
      order.orderStatus = "confirmed";
      order.paymentId = session.payment_intent;
      order.orderUpdateDate = new Date();

      // ✅ Stock decrease
      for (const item of order.cartItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { totalStock: -item.quantity },
        });
      }

      // ✅ Remove user's cart
      await Cart.findByIdAndDelete(order.cartId);

      await order.save();

      console.log("✅ Payment confirmed. Emailing:", order.userEmail);

      // ✅ Send Email
      try {
        await sendEmail({
          to: order.userEmail,
          subject: "Order Confirmed — Payment Received",
          html: orderPlacedTemplate(order.userName, order),
        });
      } catch (mailErr) {
        console.error("⚠️ Email send failed:", mailErr?.message);
        // DO NOT return error — webhook must always return 200
      }

    } catch (err) {
      console.error("❌ Stripe webhook DB update failed:", err.message);
      // still respond 200 so Stripe doesn’t retry endlessly
    }
  }

  // ✅ Required: acknowledge to Stripe
  res.json({ received: true });
};

//  NEW: Fallback function to verify payment from the success page
//  Verify Stripe Payment Immediately
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

    //  Already Verified → return
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

    // Get stored or received session_id
    const stripeSessionId = session_id || order.paymentId;
    if (!stripeSessionId) {
      return res.status(400).json({
        success: false,
        message: "Missing Stripe Session ID",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

    if (session.payment_status === "paid") {
      order.paymentStatus = "paid";
      order.orderStatus = "confirmed";
      order.paymentId = stripeSessionId;
      order.orderUpdateDate = new Date();

      //  Decrease stock
      for (const item of order.cartItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { totalStock: -item.quantity },
        });
      }

      //  Delete cart
      await Cart.findByIdAndDelete(order.cartId);

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
 
