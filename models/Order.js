import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
  userId: String,
  cartId: String,
  cartItems: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      title: String,
      image: String,
      price: { type: Number, required: true },
      quantity: Number,
    },
  ],
  addressInfo: {
    addressId: String,
    address: String,
    city: String,
    pincode: String,
    phone: String,
    notes: String,
  },
  orderStatus: String,
  paymentMethod: String,
  paymentStatus: String,
  totalAmount: Number,
  orderDate: Date,
  orderUpdateDate: Date,
  paymentId: String,
  payerId: String,
});

// ✅ Order indexes (CORRECT PLACE)
OrderSchema.index({ "cartItems.productId": 1 });
OrderSchema.index({ orderStatus: 1 });

const Order = mongoose.model("Order", OrderSchema);
export default Order;
