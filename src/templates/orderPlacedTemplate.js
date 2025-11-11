export const orderPlacedTemplate = (name, order) => `
  <div style="font-family:'Segoe UI',Roboto,Arial,sans-serif; background:#f7f7f7; padding:30px;">
    <div style="max-width:600px; margin:auto; background:white; border-radius:8px; overflow:hidden; border:1px solid #e5e5e5;">
      
      <!-- Header -->
      <div style="background:#111827; padding:18px 24px;">
        <h2 style="margin:0; color:#ffffff; font-size:20px; font-weight:600;">
          Order Confirmation
        </h2>
      </div>

      <!-- Body -->
      <div style="padding:24px; color:#333; font-size:15px; line-height:1.5;">
        <p>Hi <strong>${name}</strong>,</p>
        <p>
          Thank you for shopping with <strong>Axivibe</strong>. 
          Your order has been successfully placed.
        </p>

        <div style="margin:20px 0; padding:16px; border:1px solid #ddd; border-radius:6px;">
          <p style="margin:0;"><strong>Order ID:</strong> ${order._id}</p>
          <p style="margin:6px 0 0;"><strong>Total Amount:</strong> ₹${Number(order.totalAmount).toLocaleString()}</p>
        </div>

        <!-- Items Summary -->
        <h3 style="font-size:16px; margin:24px 0 8px; font-weight:600;">Order Summary</h3>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:8px; text-align:left; border-bottom:1px solid #ddd;">Product</th>
              <th style="padding:8px; text-align:center; border-bottom:1px solid #ddd;">Qty</th>
              <th style="padding:8px; text-align:right; border-bottom:1px solid #ddd;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${order.cartItems
              .map(
                (i) => `
              <tr>
                <td style="padding:8px; border-bottom:1px solid #eee;">${i.title}</td>
                <td style="padding:8px; text-align:center; border-bottom:1px solid #eee;">${i.quantity}</td>
                <td style="padding:8px; text-align:right; border-bottom:1px solid #eee;">
                  ₹${Number(i.price).toLocaleString()}
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div style="text-align:center; margin-top:32px;">
          <a href="${process.env.FRONTEND_URL}/shop/orders/${order._id}"
            style="background:#2563eb; color:#fff; padding:12px 24px; display:inline-block; text-decoration:none; border-radius:6px; font-weight:500;">
            View Order Status
          </a>
        </div>

        <p style="margin-top:24px; font-size:13px; color:#666;">
          For assistance or inquiries, please contact our support team.
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f3f4f6; padding:16px 24px; text-align:center; font-size:12px; color:#777;">
        © ${new Date().getFullYear()} Axivibe. All rights reserved.
      </div>
    </div>
  </div>
`;
