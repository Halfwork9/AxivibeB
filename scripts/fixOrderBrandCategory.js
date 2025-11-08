import Order from "../models/Order.js";
import Product from "../models/Product.js";

async function fixOrders() {
  console.log("🔄 Running Order migration...");

  const orders = await Order.find({ "cartItems.productId": { $exists: true } });

  for (const order of orders) {
    let changed = false;

    order.cartItems = await Promise.all(
      order.cartItems.map(async (item) => {
        if (!item.productId) return item;

        const product = await Product.findById(item.productId).lean();
        if (!product) return item;

        if (product.brandId && !item.brandId) {
          item.brandId = product.brandId;
          changed = true;
        }
        if (product.categoryId && !item.categoryId) {
          item.categoryId = product.categoryId;
          changed = true;
        }

        return item;
      })
    );

    if (changed) {
      await order.save();
      console.log(`✅ Updated order → ${order._id}`);
    }
  }

  console.log("✅ Migration completed");
}

export default fixOrders;
