export const orderPlacedTemplate = (name, order) => `
  <div style="font-family:Arial;padding:20px">
    <h2 style="color:#2c3e50">✅ Order Placed Successfully!</h2>
    <p>Hello <strong>${name}</strong>,</p>

    <p>Thank you for shopping with us. Here is your order summary:</p>

    <p><strong>Order ID:</strong> ${order._id}</p>
    <p><strong>Total:</strong> ₹${Number(order.totalAmount).toLocaleString()}</p>

    <h3>Items:</h3>
    <ul>
      ${order.cartItems
        .map(
          (i) =>
            `<li>${i.title} × ${i.quantity} — ₹${Number(
              i.price
            ).toLocaleString()}</li>`
        )
        .join("")}
    </ul>

    <a href="${process.env.FRONTEND_URL}/shop/orders/${order._id}"
      style="background:#4f46e5;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;">
      View Order
    </a>

    <p style="margin-top:20px;font-size:12px;color:#777">
      Thanks for shopping with Axivibe ❤️
    </p>
  </div>
`;
