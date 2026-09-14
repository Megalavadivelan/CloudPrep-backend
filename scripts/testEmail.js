/**
 * Standalone diagnostic for the EMAIL_SERVER / EMAIL_FROM setup — sends one
 * real test email directly through utils/email.js, completely outside the
 * Express app. Use this to isolate whether a 502 on password reset is
 * because the env vars aren't loaded, or because SMTP itself is rejecting
 * the connection.
 *
 * Usage (from the backend/ folder):
 *   node scripts/testEmail.js you@example.com
 *
 * Sends the test email TO the address you pass in.
 */
import dotenv from "dotenv";
dotenv.config();

import { sendMail, isEmailConfigured } from "../utils/email.js";

const run = async () => {
  const to = process.argv[2];

  console.log("---- Environment check ----");
  console.log("EMAIL_SERVER set:", Boolean(process.env.EMAIL_SERVER));
  console.log("EMAIL_FROM set:  ", Boolean(process.env.EMAIL_FROM));
  if (process.env.EMAIL_FROM) console.log("EMAIL_FROM value:", process.env.EMAIL_FROM);
  console.log("isEmailConfigured():", isEmailConfigured());
  console.log("");

  if (!isEmailConfigured()) {
    console.error(
      "❌ EMAIL_SERVER and/or EMAIL_FROM are not visible to this process.\n" +
        "   Most likely cause: they aren't in backend/.env, or there's a typo\n" +
        "   in the variable name, or you're running this from the wrong folder\n" +
        "   (must be run from inside backend/ so dotenv finds .env)."
    );
    process.exit(1);
  }

  if (!to) {
    console.error("Usage: node scripts/testEmail.js <recipient-email>");
    process.exit(1);
  }

  console.log(`---- Attempting to send a test email to ${to} ----`);
  const result = await sendMail({
    to,
    subject: "CloudPrep — SMTP test",
    text: "If you received this, your EMAIL_SERVER/EMAIL_FROM setup works correctly.",
    html: "<p>If you received this, your <b>EMAIL_SERVER</b>/<b>EMAIL_FROM</b> setup works correctly.</p>",
  });

  console.log("");
  console.log("Result:", result);

  if (result.sent) {
    console.log("✅ Email sent successfully. Check the inbox (and spam folder).");
  } else {
    console.error("❌ Email did NOT send. Reason:", result.reason);
    console.error(
      "   If this is a Gmail auth error, double-check: 2-Step Verification is ON,\n" +
        "   you used an App Password (not your normal password), and the @ in your\n" +
        "   address is encoded as %40 inside EMAIL_SERVER."
    );
  }

  process.exit(result.sent ? 0 : 1);
};

run().catch((err) => {
  console.error("Unexpected error while testing email:", err);
  process.exit(1);
});