import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  authMiddleware,
  googleLogin,
  forgotPassword,
  resetPassword,
} from "../../controllers/auth/auth-controller.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.post("/google", googleLogin); // ✅ Google Sign-In
router.post("/forgot-password", forgotPassword); // ✅ Forgot Password
router.post("/reset-password/:token", resetPassword); // ✅ Reset Password

router.get("/check-auth", authMiddleware, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

export default router;

