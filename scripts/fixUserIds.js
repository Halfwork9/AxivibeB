import mongoose from "mongoose";
import Order from "../models/Order.js";

const MONGO_URI = process.env.MONGO_URL;

async function fixUserIds() {
  await mongoose.connect(MONGO_URI);

  const orders = await Order.find({});

  for (let order of orders) {
    if (typeof order.userId === "string") {
      try {
        order.userId = new mongoose.Types.ObjectId(order.userId);
        await order.save();
      } catch {}
    }
  }

  console.log("✔ UserId fields converted to ObjectId");
  process.exit();
}

fixUserIds();
