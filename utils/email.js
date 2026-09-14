import nodemailer from "nodemailer";

let transporter = null;
let attemptedInit = false;

const isEmailConfigured = () =>
  Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);

const getTransporter = () => {
  if (attemptedInit) return transporter;
  attemptedInit = true;
  if (!isEmailConfigured()) return null;

  try {
    // EMAIL_SERVER is a standard SMTP connection URL, e.g.
    // smtp://user:pass@smtp.example.com:587
    transporter = nodemailer.createTransport(process.env.EMAIL_SERVER);
  } catch (err) {
    console.error("Failed to initialize email transporter:", err.message);
    transporter = null;
  }
  return transporter;
};

/**
 * Sends an email if EMAIL_SERVER/EMAIL_FROM are configured. Returns
 * `{ sent: boolean }` — callers must NOT treat `sent: false` as an error;
 * the admin-panel-delivered link/temp-password remains the fallback
 * delivery path when email isn't configured yet.
 */
export const sendMail = async ({ to, subject, text, html }) => {
  const t = getTransporter();
  if (!t) return { sent: false, reason: "Email is not configured (EMAIL_SERVER/EMAIL_FROM missing)." };

  try {
    await t.sendMail({ from: process.env.EMAIL_FROM, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error("Failed to send email:", err.message);
    return { sent: false, reason: "Email delivery failed." };
  }
};

export { isEmailConfigured };
