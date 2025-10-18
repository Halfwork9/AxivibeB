import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// This setup uses Gmail. For it to work, you MUST generate an "App Password"
// from your Google Account security settings. Your regular password will not work.
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address from .env
    pass: process.env.EMAIL_PASS, // Your Gmail App Password from .env
  },
});

export default transporter;

