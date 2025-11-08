import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

import Order from "../models/Order.js";
import Product from "../models/Product.js";

async function run() {
  try {
    console.log("🔄 Connecting to DB…");
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ Connected!");

    // Fetch all orders
    const orders = await Order.find({});
    console.log(`📦 Found ${orders.length} orders`);

    let updated = 0;

    for (const order of orders) {
      let modified = false;

      for (const item of order.cartItems) {
        // If already fixed → skip
        if (item.brandId && item.categoryId) continue;

        const product = await Product.findById(item.productId).select(
          "brandId categoryId"
        );

        if (product) {
          if (!item.brandId && product.brandId) {
            item.brandId = product.brandId;
            modified = true;
          }

          if (!item.categoryId && product.categoryId) {
            item.categoryId = product.categoryId;
            modified = true;
          }
        }
      }

      if (modified) {
        await order.save();
        updated++;
        console.log(`✅ Updated order: ${order._id}`);
      }
    }

    console.log(`✅ Migration Complete!`);
    console.log(`✅ Updated Orders: ${updated}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Migration Failed:", err);
    process.exit(1);
  }
}

run();
