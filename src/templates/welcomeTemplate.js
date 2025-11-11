export const welcomeTemplate = (name) => `
  <div style="font-family:Arial;padding:20px">
    <h2 style="color:#2c3e50">🎉 Welcome to Axivibe</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>We're excited to have you onboard. Start exploring new deals now!</p>

    <a href="${process.env.FRONTEND_URL}/shop/home"
      style="background:#4f46e5;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;">
      Start Shopping
    </a>

    <p style="margin-top:20px;font-size:12px;color:#777">
      Axivibe © All rights reserved.
    </p>
  </div>
`;
