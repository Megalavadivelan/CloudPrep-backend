import rateLimit from "express-rate-limit";

// Generic login/signup brute-force guard.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

// Tighter limit specifically for "Forgot Password" — this is the endpoint
// most exposed to enumeration/spam since it accepts an email with no auth.
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests. Please try again later." },
});

// Guards the token-consuming reset-password endpoint against brute-forcing
// the token itself.
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

// The admin-email verification step is a public, unauthenticated endpoint
// that reveals whether an email belongs to an admin account — throttle it
// so it can't be used to enumerate/brute-force admin addresses.
export const adminVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});
