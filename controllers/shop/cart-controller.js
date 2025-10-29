import Cart from "../../models/Cart.js";
import Product from "../../models/Product.js";

// ADD to cart
export const addToCart = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Invalid data provided!" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const findCurrentProductIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (findCurrentProductIndex === -1) {
      cart.items.push({ productId, quantity });
    } else {
      cart.items[findCurrentProductIndex].quantity += quantity;
    }

    await cart.save();
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error" });
  }
};

// FETCH cart items
export const fetchCartItems = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User id is mandatory!" });
    }

    let cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "image images title price salePrice",
    });

    // Auto-create new cart if none exists
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }

    // Filter out deleted products
    const validItems = cart.items.filter((item) => item.productId);
    if (validItems.length < cart.items.length) {
      cart.items = validItems;
      await cart.save();
    }

    // Flatten product details for frontend
    const flattenedItems = validItems.map((item) => {
      const product = item.productId;
      return {
        _id: item._id,
        userId,
        productId: product?._id,
        title: product?.title,
        image: product?.image || (product?.images?.[0] ?? ""),
        images: product?.images || [],
        price: product?.price,
        salePrice: product?.salePrice,
        quantity: item.quantity,
      };
    });

    console.log("Flattened cart items:", flattenedItems); // Debug log

    res.status(200).json({
      success: true,
      data: { ...cart._doc, items: flattenedItems },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error fetching cart" });
  }
};

// UPDATE cart item quantity
export const updateCartItemQty = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
    if (!userId || !productId || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Invalid data provided!" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found!" });

    const findCurrentProductIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (findCurrentProductIndex === -1) {
      return res.status(404).json({ success: false, message: "Cart item not present!" });
    }

    cart.items[findCurrentProductIndex].quantity = quantity;
    await cart.save();

    await cart.populate({ path: "items.productId", select: "image images title price salePrice" });

    const populateCartItems = cart.items.map((item) => ({
      productId: item.productId ? item.productId._id : null,
      image: item.productId ? item.productId.image : null,
      images: item.productId ? item.productId.images : null,
      title: item.productId ? item.productId.title : "Product not found",
      price: item.productId ? item.productId.price : null,
      salePrice: item.productId ? item.productId.salePrice : null,
      quantity: item.quantity,
    }));

    res.status(200).json({ success: true, data: { ...cart._doc, items: populateCartItems } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error" });
  }
};

// DELETE cart item
export const deleteCartItem = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: "Invalid data provided!" });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "image images title price salePrice",
    });

    if (!cart) return res.status(404).json({ success: false, message: "Cart not found!" });

    cart.items = cart.items.filter((item) => item.productId._id.toString() !== productId);
    await cart.save();

    await cart.populate({ path: "items.productId", select: "image images title price salePrice" });

    const populateCartItems = cart.items.map((item) => ({
      productId: item.productId ? item.productId._id : null,
      image: item.productId ? item.productId.image : null,
      images: item.productId ? item.productId.images : null,
      title: item.productId ? item.productId.title : "Product not found",
      price: item.productId ? item.productId.price : null,
      salePrice: item.productId ? item.productId.salePrice : null,
      quantity: item.quantity,
    }));

    res.status(200).json({ success: true, data: { ...cart._doc, items: populateCartItems } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error" });
  }
};

// CLEAR cart
export const clearCart = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User id is mandatory!" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found!" });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({ success: true, message: "Cart cleared successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error clearing cart" });
  }
};
