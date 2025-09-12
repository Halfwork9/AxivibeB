import Stripe from "stripe";
import Order from "../../models/Order.js";
import Cart from "../../models/Cart.js";
import Product from "../../models/Product.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-01-27.acacia", // use latest available
});

//  Create order for both Stripe and Cash on Delivery
export const createOrder = async (req, res) => {
  try {
    const {
      userId,
      cartId,
      cartItems,
      addressInfo,
      totalAmount,
      paymentMethod, // This will be 'stripe' or 'cod'
    } = req.body;

    // --- Cash on Delivery (COD) Logic ---
    if (paymentMethod === 'cod') {
      // 1. Create the new order with COD-specific statuses
      const newOrder = new Order({
        userId,
        cartId,
        cartItems,
        addressInfo,
        totalAmount,
        paymentMethod: "Cash on Delivery",
        paymentStatus: "Pending", // Payment is collected on delivery
        orderStatus: "confirmed",   // The order is confirmed immediately
        orderDate: new Date(),
        orderUpdateDate: new Date(),
      });

      // 2. Decrease stock for each product in the order
      for (let item of cartItems) {
        let product = await Product.findById(item.productId);
        if (product && product.totalStock >= item.quantity) {
          product.totalStock -= item.quantity;
          await product.save();
        } else {
          // Handle case where stock is insufficient
          return res.status(400).json({
            success: false,
            message: `Not enough stock for ${item.title}`,
          });
        }
      }

      // 3. Delete the user's cart
      // Clear the user's cart after placing order
    if (req.body.cartId) {
      await Cart.findByIdAndUpdate(req.body.cartId, { items: [] });
    }
      await Cart.findByIdAndDelete(cartId);
      
      // 4. Save the order and send success response
      const savedOrder = await newOrder.save();
      return res.status(201).json({
        success: true,
        message: "Order placed successfully with Cash on Delivery!",
        data: savedOrder,
      });
    }
    console.log("Incoming order payload:", req.body);

    // --- Stripe Payment Logic ---
    else if (paymentMethod === 'stripe') {
      // 1. Save a pending order in DB (as before)
      const newOrder = new Order({
        userId,
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

      // 2. Create Stripe Checkout session (as before)
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
            unit_amount: Math.round(item.price * 100), // Stripe needs cents
          },
          quantity: item.quantity,
        })),
        success_url: `https://axivibe-vojm.vercel.app/shop/payment-success?orderId=${newOrder._id}`,
        cancel_url: `https://axivibe-vojm.vercel.app/shop/payment-cancel`,
        metadata: {
          orderId: newOrder._id.toString(),
        },
      });

      return res.status(200).json({ success: true, url: session.url });
    }
    
    // Handle cases where paymentMethod is not provided or invalid
    else {
        return res.status(400).json({ success: false, message: "Invalid payment method specified." });
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

  // Handle event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata.orderId;

    try {
      const order = await Order.findById(orderId);
      if (!order) return;

      order.paymentStatus = "paid";
      order.orderStatus = "confirmed";
      order.paymentId = session.payment_intent;
      order.orderUpdateDate = new Date();

      // Decrease stock for each product
      for (let item of order.cartItems) {
        let product = await Product.findById(item.productId);
        if (product) {
          product.totalStock -= item.quantity;
          await product.save();
        }
      }

      // Delete cart
      await Cart.findByIdAndDelete(order.cartId);

      await order.save();
      console.log(`✅ Order ${orderId} confirmed.`);
    } catch (err) {
      console.error("Error updating order after payment:", err);
    }
  }

  res.json({ received: true });
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
