import paypal from "@paypal/checkout-server-sdk";
import dotenv from "dotenv";

dotenv.config();

function environment() {
  if (process.env.PAYPAL_MODE === "live") {
    return new paypal.core.LiveEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
  } else {
    return new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
  }
}

function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

// ✅ only named exports (no default export)
export { paypal, client };
