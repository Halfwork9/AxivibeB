import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

dotenv.config();

async function fixOrders() {
  console.log("🔄 Starting enhanced order migration...");

  await mongoose.connect(process.env.MONGO_URI);
  const orders = await Order.find({ "cartItems.productId": { $exists: true } });

  for (const order of orders) {
    let changed = false;

    for (const item of order.cartItems) {
      if (!item.productId) continue;

      // Only update if brandId missing
      if (!item.brandId || !item.categoryId) {
        const product = await Product.findById(item.productId).lean();
        if (product) {
          item.brandId = product.brandId || item.brandId;
          item.categoryId = product.categoryId || item.categoryId;
          changed = true;
        }
      }
    }

    if (changed) {
      await order.save();
      console.log(`✅ Updated order ${order._id}`);
    }
  }

  console.log("✅ Migration done. Closing connection...");
  await mongoose.disconnect();
}

fixOrders()
  .then(() => {
    console.log("🏁 All done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Migration failed", err);
    process.exit(1);
  });
