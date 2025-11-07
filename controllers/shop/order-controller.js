import Stripe from "stripe";
import Order from "../../models/Order.js";
import Cart from "../../models/Cart.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-01-27.acacia",
});

// Create order for both Stripe and COD
export const createOrder = async (req, res) => {
  try {
    const {
      userId,
      cartId,
      cartItems,
      addressInfo,
      totalAmount,
      paymentMethod,
    } = req.body;

    console.log("Incoming order payload:", req.body);

    // ✅ Fetch REAL user info
    const user = await User.findById(userId).select("userName email");
    const userName = user?.userName || "";
    const userEmail = user?.email || "";

    // ----- ✅ CASH ON DELIVERY -----
    if (paymentMethod === "cod") {
      const newOrder = new Order({
        userId,
        cartId,
        userName,
        userEmail,
        cartItems,
        addressInfo,
        totalAmount,
        paymentMethod: "Cash on Delivery",
        paymentStatus: "Pending",
        orderStatus: "confirmed",
        orderDate: new Date(),
        orderUpdateDate: new Date(),
      });

      // ✅ Decrease product stock
      for (let item of cartItems) {
        let product = await Product.findById(item.productId);
        if (product && product.totalStock >= item.quantity) {
          product.totalStock -= item.quantity;
          await product.save();
        } else {
          return res.status(400).json({
            success: false,
            message: `Not enough stock for ${item.title}`,
          });
        }
      }

      // ✅ Clear cart
      if (cartId) {
        await Cart.findByIdAndUpdate(cartId, { items: [] });
        await Cart.findByIdAndDelete(cartId);
      }

      const savedOrder = await newOrder.save();
      return res.status(201).json({
        success: true,
        message: "COD order placed successfully!",
        data: savedOrder,
      });
    }

    // ----- ✅ STRIPE -----
    else if (paymentMethod === "stripe") {
      const newOrder = new Order({
        userId,
        cartId,
        userName,
        userEmail,
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
        success_url: `https://nikhilmamdekar.site/shop/payment-success?orderId=${newOrder._id}`,
        cancel_url: `https://nikhilmamdekar.site/shop/payment-cancel`,
        metadata: {
          orderId: newOrder._id.toString(),
        },
      });

      return res.status(200).json({ success: true, url: session.url });
    }

    // ❌ Invalid payment method
    else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment method." });
    }
  } catch (e) {
    console.error("Error in createOrder:", e);
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
    console.error("⚠️ Webhook signature verification failed:", err.message);
    return res.sendStatus(400);
  }

  //  ADD LOG: Log the received event type
  console.log(`🔔 Webhook received: ${event.type}`);

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata.orderId;

    //  ADD LOG: Log the orderId from the metadata
    console.log(`🔔 Processing payment for Order ID: ${orderId}`);

    try {
      const order = await Order.findById(orderId);

      //  ADD LOG: Check if the order was found
      if (!order) {
        console.error(`❌ Order not found for ID: ${orderId}`);
        return res.status(404).json({ error: "Order not found" });
      }

      //  ADD LOG: Check if the order is already paid to prevent duplicate processing
      if (order.paymentStatus === 'paid') {
        console.log(`ℹ️ Order ${orderId} is already marked as paid. Skipping.`);
        return res.json({ received: true });
      }
      
      // Update the order
      order.paymentStatus = "paid";
      order.orderStatus = "confirmed"; // Or "processing" if you have that state
      order.paymentId = session.payment_intent;
      order.orderUpdateDate = new Date();

      // Decrease stock for each product
      for (const item of order.cartItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { totalStock: -item.quantity },
        });
      }

      // Delete cart
      await Cart.findByIdAndDelete(order.cartId);

      await order.save();

      //  ADD LOG: Confirm success
      console.log(`✅ Order ${orderId} payment confirmed and status updated.`);
      
    } catch (err) {
      console.error(`❌ Error updating order ${orderId} after payment:`, err);
      // It's important to still return a 200 to Stripe to avoid retries
      // but we should log the error for manual intervention.
    }
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
};

//  NEW: Fallback function to verify payment from the success page
export const verifyStripePayment = async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, message: "Order ID is required." });
  }

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // If order is already paid, no need to verify again
    if (order.paymentStatus === 'paid') {
      return res.json({ success: true, data: order, message: "Order already paid." });
    }

    // This verification should only apply to Stripe orders
    if (order.paymentMethod !== 'stripe' || !order.paymentId) {
      return res.status(400).json({ success: false, message: "This is not a valid Stripe order for verification." });
    }

    // Retrieve the session from Stripe to confirm payment status
    const session = await stripe.checkout.sessions.retrieve(order.paymentId);

    if (session.payment_status === 'paid') {
      // Update the order in the database
      order.paymentStatus = 'paid';
      order.orderStatus = 'confirmed'; // or 'processing'
      order.orderUpdateDate = new Date();
      await order.save();

      console.log(` Order ${orderId} verified and updated via success page fallback.`);
      return res.json({ success: true, data: order, message: "Payment verified successfully." });
    } else {
      return res.status(400).json({ success: false, message: "Payment has not been completed yet." });
    }
  } catch (error) {
    console.error("Error during payment verification:", error);
    res.status(500).json({ success: false, message: "Payment verification failed." });
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
