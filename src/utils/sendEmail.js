// src/utils/sendEmail.js
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const msg = {
      to,
      from: {
        name: "Axivibe",
        email: process.env.EMAIL_USER || "support@axivibe.com",
      },
      subject,
      html,
    };

    await sgMail.send(msg);
    console.log("✅ Email sent →", subject);

  } catch (err) {
    console.error("❌ Email error →", err.response?.body || err.message);
  }
};
