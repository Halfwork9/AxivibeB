import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../../models/User.js";
import { OAuth2Client } from "google-auth-library";
import sgMail from "../../config/sendgrid.js"; // Adjust path as needed
import { sendEmail } from "../../src/utils/sendEmail.js";
import { welcomeTemplate } from "../../src/templates/welcomeTemplate.js";
import { resetPasswordTemplate } from "../../src/templates/resetPasswordTemplate.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
//
// ✅ Helper: Send cookie securely (works for both login types)
//
const setAuthCookie = (res, token) => {
  // Try without specifying domain first
  res.cookie("token", token, {
    httpOnly: true,
    secure: true, // Required for HTTPS
    sameSite: "None", // Required for cross-site cookies
    // Remove the domain property to let browser handle it
    // domain: ".nikhilmamdekar.site",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/", // Ensure cookie is available on all paths
  });
};
//
// ✅ Helper: Generate JWT and send cookie
//
const sendTokenResponse = (res, user, message) => {
  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
      userName: user.userName,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  setAuthCookie(res, token);
  return res.json({
    success: true,
    message,
    token,
    user: {
      id: user._id,
      email: user.email,
      userName: user.userName,
      role: user.role,
    },
  });
};
//
// ✅ Register User
//
export const registerUser = async (req, res) => {
  try {
    const { userName, email, password } = req.body;

    // 1️⃣ Validate
    if (!userName || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // 2️⃣ Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.json({
        success: false,
        message: "User already exists with that email.",
      });
    }

    // 3️⃣ Hash password
    const hash = await bcrypt.hash(password, 12);

    // 4️⃣ Create user
    const newUser = new User({
      userName,
      email,
      password: hash,
      role: "user",
    });

    await newUser.save();

    // 5️⃣ Send welcome email (safe — inside TRY)
    try {
      await sendEmail({
        to: newUser.email,
        subject: "Welcome to Axivibe 🎉",
        html: welcomeTemplate(newUser.userName),
      });
      console.log("✅ Welcome email sent");
    } catch (emailErr) {
      console.error("⚠ Welcome email failed:", emailErr.message);
    }

    // 6️⃣ Final response
    return res.status(200).json({
      success: true,
      message: "Registration successful",
    });

  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

//
// ✅ Email + Password Login
//
export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message:
          "This account was created with Google. Please use Google Sign-In.",
      });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res
        .status(400)
        .json({ success: false, message: "Incorrect password." });
    sendTokenResponse(res, user, "Logged in successfully.");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
//
// ✅ Google Login
//
export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token)
      return res.status(400).json({ success: false, message: "Missing Google token" });
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        userName: name,
        email,
        password: null,
        google: true,
        avatar: picture,
        role: "user",
      });
    }
    // ✅ Create your own signed JWT
    const authToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "CLIENT_SECRET_KEY",
      { expiresIn: "7d" }
    );
    setAuthCookie(res, authToken);
    res.status(200).json({
      success: true,
      message: "Google login successful",
      token: authToken,
      user: {
        id: user._id,
        email: user.email,
        userName: user.userName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Google login error:", err.message);
    res.status(401).json({ success: false, message: "Google login failed" });
  }
};
// FORGOT PASSWORD
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with that email." });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${resetToken}`;
    const footer = `
      <div style="font-size: 12px; color: #777; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px;">
        <p>This email was sent by Axivibe. To stop receiving these emails, <a href="${process.env.FRONTEND_URL}/unsubscribe">unsubscribe</a>.</p>
        <p>Axivibe<br>123 Example Street<br>City, State, ZIP<br>Country</p>
        <p>Contact us at <a href="mailto:support@nikhilmamdekar.site">support@nikhilmamdekar.site</a></p>
      </div>
    `;
    const msg = {
  to: user.email,
  from: {
    name: "Axivibe Support",
    email: process.env.EMAIL_USER || "support@nikhilmamdekar.site",
  },
  subject: "Reset Your Axivibe Password",
  text: `Hi ${user.userName || "there"},\n\nWe received a request to reset your password. Click here to set a new password (valid for 1 hour):\n${resetUrl}\n\nIf you didn’t request this, you can ignore this message.\n\nTeam Axivibe`,
 html: `
  <div style="margin:0;padding:0;background:#f5f7fa;font-family:'Inter',Arial,sans-serif;">
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:24px 0;">
          <table role="presentation" style="width:600px;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            
            <!-- HEADER -->
            <tr>
              <td style="background:#111827;padding:24px;text-align:center;">
                <img src="https://res.cloudinary.com/daxujngz2/image/upload/v1730879546/axivibe-logo-white.png"
                     alt="Axivibe"
                     style="height:42px;margin-bottom:8px;" />
                <h2 style="color:white;margin:0;font-size:22px;font-weight:600;">
                  Password Reset Request
                </h2>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="padding:32px;">
                <p style="font-size:16px;color:#111;margin:0 0 16px;">
                  Hi <strong>${user.userName || "there"}</strong>,
                </p>

                <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px;">
                  We received a request to reset your Axivibe account password.  
                  Click the button below to create a new password.
                </p>

                <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px;">
                  This link is valid for <strong>1 hour</strong>.
                </p>

                <!-- BUTTON -->
                <div style="text-align:center;margin:32px 0;">
                  <a href="${resetUrl}"
                     style="
                        background:#4f46e5;
                        color:#fff;
                        padding:14px 28px;
                        font-size:16px;
                        border-radius:8px;
                        text-decoration:none;
                        display:inline-block;
                        font-weight:600;
                      ">
                    Reset Password
                  </a>
                </div>

                <p style="font-size:14px;color:#6b7280;line-height:1.5;margin:24px 0 16px;">
                  If you did not request this, simply ignore this message — your password will remain unchanged.
                </p>

                <p style="font-size:14px;color:#6b7280;margin:0;">
                  Need help? Contact us anytime at  
                  <a href="mailto:support@nikhilmamdekar.site" style="color:#4f46e5;text-decoration:none;">
                    support@nikhilmamdekar.site
                  </a>.
                </p>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background:#f3f4f6;padding:20px;text-align:center;">
                <p style="font-size:12px;color:#6b7280;margin:0 0 6px;">
                  © ${new Date().getFullYear()} <strong>Axivibe</strong>. All rights reserved.
                </p>

                <p style="font-size:12px;color:#9ca3af;margin:0;">
                  This email was sent to <strong>${user.email}</strong>.
                  <br />
                  If you didn’t request this email, you can safely ignore it.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
`,
};

    await sgMail.send(msg);
    res.status(200).json({ success: true, message: "Reset email sent successfully. Please check your inbox or spam/junk folder." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
};
// RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "Token invalid or expired." });
    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ success: true, message: "Password reset successful." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// LOGOUT
export const logoutUser = (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      // Remove domain property here too
      path: "/",
    })
    .json({ success: true, message: "Logged out successfully!" });
};
// AUTH MIDDLEWARE
export const authMiddleware = (req, res, next) => {
  console.log("AUTH MIDDLEWARE");
  console.log("Header:", req.headers.authorization);
  console.log("Cookies:", req.cookies?.token);

  let token = null;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "No token!" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log("TOKEN VALID → User ID:", decoded.id);
    next();
  } catch (err) {
    console.log("INVALID TOKEN:", err.message);
    return res.status(401).json({ success: false, message: "Invalid token!" });
  }
};
