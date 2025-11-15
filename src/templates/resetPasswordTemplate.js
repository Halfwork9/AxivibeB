export const resetPasswordTemplate = (name, link) => `
  <div style="font-family:Arial;padding:20px">
    <h2 style="color:#2c3e50">🔐 Reset Your Password</h2>

    <p>Hi <strong>${name}</strong>,</p>

    <p>You requested to reset your password. Click the button below:</p>

    <a href="${link}"
      style="background:#4f46e5;color:#fff;padding:12px 20px;
      text-decoration:none;border-radius:6px;display:inline-block;margin-top:10px;">
      Reset Password
    </a>

    <p style="margin-top:15px">If the button doesn't work, use the link below:</p>

    <p style="font-size:14px;color:#555;word-break:break-all;">
      ${link}
    </p>

    <p style="margin-top:20px;font-size:12px;color:#777">
      This link expires in 15 minutes.
    </p>

    <p style="margin-top:20px;font-size:12px;color:#777">
      Axivibe © All Rights Reserved.
    </p>
  </div>
`;
