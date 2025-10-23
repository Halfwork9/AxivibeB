import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../../models/User.js";
import { OAuth2Client } from "google-auth-library";
import transporter from "../../config/nodemailer.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- Helper: Send JWT as cookie ---
const sendTokenResponse = (res, user, message) => {
  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
      userName: user.userName,
    },
    process.env.JWT_SECRET || "CLIENT_SECRET_KEY",
    { expiresIn: "1d" }
  );

  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000,
    })
    .json({
      success: true,
      message,
      user: {
        id: user._id,
        email: user.email,
        userName: user.userName,
        role: user.role,
      },
    });
};

// ✅ REGISTER USER
export const registerUser = async (req, res) => {
  const { userName, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.json({
        success: false,
        message: "User already exists with that email.",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const hash = await bcrypt.hash(password, 12);
    const newUser = new User({
      userName,
      email,
      password: hash,
      role: "user",
    });

    await newUser.save();
    res.status(200).json({ success: true, message: "Registration successful" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ EMAIL + PASSWORD LOGIN
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

// ✅ GOOGLE LOGIN
export const googleLogin = async (req, res) => {
  const { token } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { name, email, sub, picture } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        googleId: sub,
        userName: name,
        email,
        avatar: picture,
      });
      await user.save();
    }

    sendTokenResponse(res, user, "Google Sign-In successful.");
  } catch (error) {
    console.error("Google auth error:", error);
    res
      .status(400)
      .json({ success: false, message: "Google authentication failed." });
  }
};

// ✅ FORGOT PASSWORD
// ✅ FORGOT PASSWORD (Send Reset Email)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, message: "No account found with that email." });

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${resetToken}`;

    const mailOptions = {
      from: `Axivibe Support <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Reset Your Axivibe Password",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; border-radius: 8px;">
          <h2 style="color:#2c3e50;">Password Reset Request</h2>
          <p style="font-size:15px; color:#555;">
            Hi ${user.userName || "there"}, we received a request to reset your password.
          </p>
          <p>
            Click below to set a new password. This link is valid for <strong>1 hour</strong>.
          </p>
          <a href="${resetUrl}" 
             style="background-color:#1e90ff; color:#fff; padding:10px 20px; 
                    border-radius:5px; text-decoration:none; display:inline-block; margin-top:10px;">
            Reset Password
          </a>
          <p style="font-size:13px; color:#777; margin-top:20px;">
            If you didn’t request this, you can safely ignore this email.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: "Reset email sent successfully." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
};


// ✅ RESET PASSWORD
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

// ✅ LOGOUT
export const logoutUser = (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
    })
    .json({ success: true, message: "Logged out successfully!" });
};

// ✅ AUTH MIDDLEWARE
export const authMiddleware = (req, res, next) => {
  let token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token)
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized user!" });

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "CLIENT_SECRET_KEY"
    );
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized user!" });
  }
};
