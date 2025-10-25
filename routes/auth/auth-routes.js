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

// Email/Password Authentication
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);

//  Google Authentication
router.post("/google-login", googleLogin);

//  Password Recovery
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Auth Check
// --- CHECK AUTH ROUTE ---
router.get("/check-auth", authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  res.status(200).json({
    success: true,
    message: "Authenticated user",
    user: req.user,
  });
});

export default router;
