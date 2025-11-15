import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
 userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
},
  userName: { type: String },
  userEmail: { type: String },
  emailSent: {
       type: Boolean,
       default: false,
     },

  cartId: String,

  cartItems: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      title: String,
      image: String,
      price: { type: Number, required: true },
      quantity: Number,
       brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
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

// ✅ Index
OrderSchema.index({ "cartItems.productId": 1 });
OrderSchema.index({ "cartItems.brandId": 1 });
OrderSchema.index({ "cartItems.categoryId": 1 });
OrderSchema.index({ orderStatus: 1 });

const Order = mongoose.model("Order", OrderSchema);
export default Order;
