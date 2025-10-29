import Cart from "../../models/Cart.js";
import Product from "../../models/Product.js";

// ✅ Helper — populate and flatten cart
const populateAndFlattenCart = async (cart, userId) => {
  await cart.populate({
    path: "items.productId",
    select: "image images title price salePrice",
  });

  const validItems = cart.items.filter((item) => item.productId);

  return validItems.map((item) => {
    const product = item.productId;
    const mainImage =
      product?.image && product.image.trim() !== ""
        ? product.image
        : product?.images?.[0] || "";

    return {
      _id: item._id,
      userId,
      productId: product?._id?.toString(),
      title: product?.title || "Untitled Product",
      image: mainImage,
      images: product?.images || [],
      price: product?.price || 0,
      salePrice: product?.salePrice || 0,
      quantity: item.quantity,
    };
  });
};

// ✅ ADD to cart
export const addToCart = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
    if (!userId || !productId || quantity <= 0)
      return res.status(400).json({ success: false, message: "Invalid data" });

    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    const idx = cart.items.findIndex((i) => i.productId.toString() === productId);
    if (idx === -1) cart.items.push({ productId, quantity });
    else cart.items[idx].quantity += quantity;

    await cart.save();
    const flattenedItems = await populateAndFlattenCart(cart, userId);
    return res.status(200).json({ success: true, cartItems: flattenedItems });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ success: false, message: "Error adding to cart" });
  }
};

// ✅ FETCH cart
export const fetchCartItems = createAsyncThunk(
  "shopCart/fetchCartItems",
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/shop/cart/get/${userId}`);
      // handle both formats: {cartItems: [...]} or {data: [...]}
      return data.cartItems || data.data || [];
    } catch (err) {
      console.error("❌ fetchCartItems error:", err);
      return rejectWithValue(err.response?.data || "Error fetching cart");
    }
  }
);


// ✅ UPDATE qty
export const updateCartItemQty = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
    if (!userId || !productId || quantity <= 0)
      return res.status(400).json({ success: false, message: "Invalid data" });

    const cart = await Cart.findOne({ userId });
    if (!cart)
      return res.status(404).json({ success: false, message: "Cart not found" });

    const idx = cart.items.findIndex((i) => i.productId.toString() === productId);
    if (idx === -1)
      return res.status(404).json({ success: false, message: "Item not found" });

    cart.items[idx].quantity = quantity;
    await cart.save();

    const flattenedItems = await populateAndFlattenCart(cart, userId);
    return res.status(200).json({ success: true, cartItems: flattenedItems });
  } catch (err) {
    console.error("Update cart error:", err);
    res.status(500).json({ success: false, message: "Error updating cart" });
  }
};

// ✅ DELETE item
export const deleteCartItem = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const cart = await Cart.findOne({ userId });
    if (!cart)
      return res.status(404).json({ success: false, message: "Cart not found" });

    cart.items = cart.items.filter((i) => i.productId.toString() !== productId);
    await cart.save();

    const flattenedItems = await populateAndFlattenCart(cart, userId);
    return res.status(200).json({ success: true, cartItems: flattenedItems });
  } catch (err) {
    console.error("Delete cart error:", err);
    res.status(500).json({ success: false, message: "Error deleting item" });
  }
};

// ✅ CLEAR cart
export const clearCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const cart = await Cart.findOne({ userId });
    if (!cart)
      return res.status(404).json({ success: false, message: "Cart not found" });

    cart.items = [];
    await cart.save();

    return res.status(200).json({ success: true, cartItems: [] });
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ success: false, message: "Error clearing cart" });
  }
};
