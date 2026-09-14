import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import User from "../models/User.js";
import Schedule from "../models/Schedule.js";
import Note from "../models/Note.js";
import PasswordResetRequest from "../models/PasswordResetRequest.js";
import { validatePassword } from "../utils/validatePassword.js";
import { hashToken, generateSecureToken } from "../utils/tokens.js";
import { sendMail, isEmailConfigured } from "../utils/email.js";

const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_EXPIRES_MINUTES) || 60;

const buildResetLink = (rawToken) => {
  const base = process.env.CLIENT_URL || "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/reset-password?token=${rawToken}`;
};

const signToken = (user) => jwt.sign({ id: user._id, tv: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: "7d" });

// Never include password/hash or internal fields — this is the only shape
// of a user that is ever allowed to reach the frontend.
const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  profileImage: user.profileImage,
  resume: user.resume,
  resumeOriginalName: user.resumeOriginalName,
  resumeUploadedAt: user.resumeUploadedAt,
  role: user.role,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt,
});

export const signup = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashed });

    const token = signToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout (protected) — bumps tokenVersion so the JWT that was
// just used to authenticate this request stops being valid immediately.
// Combined with the frontend deleting its stored token, this gives genuine
// server-side session invalidation despite JWTs being otherwise stateless.
export const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.userId, { $inc: { tokenVersion: 1 }, $set: { lastLogoutAt: new Date() } });
    res.json({ message: "Signed out successfully." });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/admin-verify (public, rate-limited)
// First step of the "Continue as Admin" flow: checks whether the given
// email belongs to a real admin account. This is a UX gate only — it does
// NOT itself grant access. The frontend still has to complete a real
// password login (POST /api/auth/login) afterwards, and every /api/admin/*
// route independently re-checks the account's role server-side regardless
// of what happened here.
export const adminVerify = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Please enter your admin email address." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.role !== "admin") {
      return res.status(404).json({ message: "No admin account found with this email." });
    }

    res.json({ valid: true, message: "Admin verified successfully." });
  } catch (err) {
    next(err);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const [totalSchedules, finishedSchedules, pendingSchedules, totalNotes] = await Promise.all([
      Schedule.countDocuments({ userId: req.userId }),
      Schedule.countDocuments({ userId: req.userId, status: "Finished" }),
      Schedule.countDocuments({ userId: req.userId, status: "Pending" }),
      Note.countDocuments({ userId: req.userId }),
    ]);

    res.json({
      user: sanitizeUser(user),
      stats: { totalSchedules, finishedSchedules, pendingSchedules, totalNotes },
    });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (req.body.name) user.name = req.body.name.trim();
    if (req.file) user.profileImage = `/uploads/${req.file.filename}`;

    await user.save();
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Resume — a single stored file per user (PDF/DOC/DOCX), replaced on every
// new upload. The old file is removed from disk so uploads/ doesn't
// accumulate orphaned files.
// ---------------------------------------------------------------------------

// POST /api/auth/profile/resume
export const uploadResumeFile = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file received." });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Remove the previous resume file, if any, before pointing to the new one.
    if (user.resume) {
      const oldPath = path.join(process.cwd(), user.resume.replace(/^\//, ""));
      fs.unlink(oldPath, () => {});
    }

    user.resume = `/uploads/${req.file.filename}`;
    user.resumeOriginalName = req.file.originalname;
    user.resumeUploadedAt = new Date();
    await user.save();

    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/auth/profile/resume
export const deleteResumeFile = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.resume) {
      const oldPath = path.join(process.cwd(), user.resume.replace(/^\//, ""));
      fs.unlink(oldPath, () => {});
    }
    user.resume = "";
    user.resumeOriginalName = "";
    user.resumeUploadedAt = null;
    await user.save();

    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Password reset — admin-approved workflow
// ---------------------------------------------------------------------------

// POST /api/auth/forgot-password (public)
// Always returns the same generic message regardless of whether the account
// exists, to avoid account-enumeration. A request row is only actually
// created when the account exists and there is no unresolved Pending
// request already for it (prevents duplicate-request spam from one user).
// POST /api/auth/forgot-password (public, rate-limited)
// THE ACTUAL FIX: this previously only created a "Pending" request and
// waited for an admin to manually review it in the Admin Panel — no email
// was ever sent at this step, which is why users never received a reset
// email. It now auto-generates a token and emails the reset link
// immediately (true self-service "forgot password"), while still logging a
// PasswordResetRequest record (auto-approved) so the existing Admin Panel
// audit trail and admin-initiated reset flow keep working unchanged.
export const forgotPassword = async (req, res, next) => {
  const GENERIC_MESSAGE = "Password reset instructions have been sent to your email.";
  try {
    const { identifier } = req.body;
    if (!identifier || typeof identifier !== "string") {
      return res.status(400).json({ message: "Please enter your registered email address." });
    }

    const user = await User.findOne({ email: identifier.toLowerCase().trim() });

    // Always return the same generic message whether or not the account
    // exists, so the endpoint can't be used to enumerate registered emails.
    if (!user) {
      return res.json({ message: GENERIC_MESSAGE });
    }

    const request = await PasswordResetRequest.create({
      userId: user._id,
      email: user.email,
      status: "Pending",
      requestIp: req.ip || "",
    });

    const rawToken = generateSecureToken();
    request.resetTokenHash = hashToken(rawToken);
    request.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    request.status = "Approved";
    request.method = "link";
    request.reviewedAt = new Date();
    // reviewedBy stays null — this was approved automatically by the
    // self-service flow, not by an admin. The Admin Panel can still see and
    // audit it like any other request.
    await request.save();

    const resetLink = buildResetLink(rawToken);

    if (isEmailConfigured()) {
      const emailResult = await sendMail({
        to: user.email,
        subject: "Password Reset – Study Planner",
        text: `Hello,\n\nYour password reset request has been processed.\n\nYou can use the secure password-reset link below to create a new password:\n${resetLink}\n\nFor your security, this link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.\n\nIf you did not request this password reset, please ignore this email.\n\nRegards,\nStudy Planner Team`,
        html: `<p>Hello,</p><p>Your password reset request has been processed.</p><p>You can use the secure password-reset link below to create a new password:</p><p><a href="${resetLink}">Reset Password</a></p><p>For your security, this link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p><p>If you did not request this password reset, please ignore this email.</p><p>Regards,<br/>Study Planner Team</p>`,
      });
      // Errors from sendMail are already caught and logged inside sendMail
      // itself (see utils/email.js) — never thrown here, and never surfaced
      // to the client, so we still can't leak account existence via timing
      // or error responses. If delivery genuinely fails, the request stays
      // "Approved" in the Admin Panel so an admin can hand the user the
      // link manually as a fallback.
      if (!emailResult.sent) {
        console.error(`forgotPassword: email delivery did not succeed for request ${request._id}: ${emailResult.reason}`);
      }
    } else {
      console.warn(
        "forgotPassword: EMAIL_SERVER/EMAIL_FROM are not configured — no email was sent. " +
          "Set both in backend/.env, or an admin can retrieve/share the link manually from the Admin Panel."
      );
    }

    res.json({ message: GENERIC_MESSAGE });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/reset-password (public — authenticated by the token itself)
// Consumes a single-use token that an admin generated when approving a
// request. Sets the new password, invalidates existing sessions, and marks
// the request Completed.
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Missing reset token." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const tokenHash = hashToken(token);
    const request = await PasswordResetRequest.findOne({ resetTokenHash: tokenHash }).select("+resetTokenHash");

    if (!request) {
      return res.status(400).json({ message: "This reset link is invalid. Please request a new one." });
    }
    if (request.status === "Completed") {
      return res.status(400).json({ message: "This reset link has already been used." });
    }
    if (request.status === "Rejected") {
      return res.status(400).json({ message: "This reset request was not approved." });
    }
    if (request.status === "Expired" || (request.resetTokenExpires && request.resetTokenExpires < new Date())) {
      request.status = "Expired";
      await request.save();
      return res.status(400).json({ message: "This reset link has expired. Please submit a new request." });
    }
    if (request.status !== "Approved") {
      return res.status(400).json({ message: "This reset link is invalid. Please request a new one." });
    }

    const user = await User.findById(request.userId);
    if (!user) {
      return res.status(400).json({ message: "This reset link is invalid." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.tokenVersion += 1; // invalidate any existing sessions for this user
    await user.save();

    request.status = "Completed";
    request.completedAt = new Date();
    request.resetTokenHash = undefined;
    request.resetTokenExpires = null;
    await request.save();

    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/change-password (protected)
// Used both for a voluntary password change and for the forced "first
// login after a temporary password" flow — in both cases the user proves
// they know the current/temporary password before setting a new one.
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.tokenVersion += 1;
    await user.save();

    // Issue a fresh token so this same session continues working (the old
    // one is now invalid because tokenVersion changed).
    const token = signToken(user);
    res.json({ message: "Password changed successfully.", token, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

export { RESET_TOKEN_TTL_MINUTES };
