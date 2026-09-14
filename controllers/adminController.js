import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Schedule from "../models/Schedule.js";
import ActivityLog from "../models/ActivityLog.js";
import PasswordResetRequest from "../models/PasswordResetRequest.js";
import AcademyFile from "../models/AcademyFile.js";
import TrackTopic from "../models/TrackTopic.js";
import TrackCategory from "../models/TrackCategory.js";
import { generateSecureToken, hashToken, generateTempPassword } from "../utils/tokens.js";
import { sendMail, isEmailConfigured } from "../utils/email.js";

const ACTIVE_USER_WINDOW_DAYS = 7;

const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_EXPIRES_MINUTES) || 60;

const buildResetLink = (rawToken) => {
  const base = process.env.CLIENT_URL || "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/reset-password?token=${rawToken}`;
};

// Lazily flips any Approved-but-expired requests to "Expired" so the admin
// list always reflects reality without needing a background cron job.
const expireStaleRequests = async () => {
  await PasswordResetRequest.updateMany(
    { status: "Approved", resetTokenExpires: { $lt: new Date() } },
    { $set: { status: "Expired" } }
  );
};

// GET /api/admin/password-reset-requests?status=Pending
export const listResetRequests = async (req, res, next) => {
  try {
    await expireStaleRequests();
    const { status } = req.query;
    const filter = status ? { status } : {};
    const requests = await PasswordResetRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "name email")
      .populate("reviewedBy", "name email");
    res.json({ requests });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/password-reset-requests/:id
export const getResetRequest = async (req, res, next) => {
  try {
    await expireStaleRequests();
    const request = await PasswordResetRequest.findById(req.params.id)
      .populate("userId", "name email")
      .populate("reviewedBy", "name email");
    if (!request) return res.status(404).json({ message: "Request not found." });
    res.json({ request });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/password-reset-requests/:id/approve
// Generates a secure, single-use, expiring reset link. Emails it if email is
// configured; either way the raw link is also returned in the response so
// the admin can copy/share it manually.
export const approveResetRequest = async (req, res, next) => {
  try {
    const request = await PasswordResetRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found." });
    if (request.status !== "Pending") {
      return res.status(400).json({ message: `This request has already been ${request.status.toLowerCase()}.` });
    }

    const rawToken = generateSecureToken();
    request.resetTokenHash = hashToken(rawToken);
    request.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    request.status = "Approved";
    request.method = "link";
    request.reviewedAt = new Date();
    request.reviewedBy = req.userId;
    await request.save();

    const resetLink = buildResetLink(rawToken);

    let emailResult = { sent: false };
    if (isEmailConfigured()) {
      emailResult = await sendMail({
        to: request.email,
        subject: "CloudPrep — Password Reset Instructions",
        text: `A password reset was approved for your CloudPrep account. Use this link within ${RESET_TOKEN_TTL_MINUTES} minutes to set a new password: ${resetLink}`,
        html: `<p>A password reset was approved for your CloudPrep account.</p><p><a href="${resetLink}">Click here to set a new password</a> (expires in ${RESET_TOKEN_TTL_MINUTES} minutes).</p>`,
      });
    }

    res.json({
      message: "Request approved. A secure reset link has been generated.",
      request,
      resetLink,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      emailSent: emailResult.sent,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/password-reset-requests/:id/temp-password
// Alternative to the link flow: issues a one-time temporary password
// immediately and forces a password change on next login.
export const issueTempPassword = async (req, res, next) => {
  try {
    const request = await PasswordResetRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found." });
    if (request.status !== "Pending") {
      return res.status(400).json({ message: `This request has already been ${request.status.toLowerCase()}.` });
    }

    const user = await User.findById(request.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const tempPassword = generateTempPassword();
    user.password = await bcrypt.hash(tempPassword, 10);
    user.mustChangePassword = true;
    user.tokenVersion += 1; // invalidate any of the user's existing sessions
    await user.save();

    request.status = "Completed";
    request.method = "temporary_password";
    request.reviewedAt = new Date();
    request.reviewedBy = req.userId;
    request.completedAt = new Date();
    await request.save();

    let emailResult = { sent: false };
    if (isEmailConfigured()) {
      emailResult = await sendMail({
        to: request.email,
        subject: "CloudPrep — Temporary Password",
        text: `An administrator issued a temporary password for your CloudPrep account: ${tempPassword}\nYou will be required to set a new password after signing in.`,
        html: `<p>An administrator issued a temporary password for your CloudPrep account:</p><p style="font-family:monospace;font-size:16px">${tempPassword}</p><p>You will be required to set a new password after signing in.</p>`,
      });
    }

    // The raw temporary password is returned exactly once, here, to the
    // admin who requested it. It is never stored or logged in plain text.
    res.json({
      message: "Temporary password issued.",
      request,
      tempPassword,
      emailSent: emailResult.sent,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/password-reset-requests/:id/reject
export const rejectResetRequest = async (req, res, next) => {
  try {
    const request = await PasswordResetRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found." });
    if (request.status !== "Pending") {
      return res.status(400).json({ message: `This request has already been ${request.status.toLowerCase()}.` });
    }

    request.status = "Rejected";
    request.reviewedAt = new Date();
    request.reviewedBy = req.userId;
    request.rejectionReason = (req.body?.reason || "").trim().slice(0, 300);
    await request.save();

    res.json({ message: "Request rejected.", request });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/password-reset-requests/:id/complete
// Manual override for edge cases (e.g. the user was helped outside the
// system). Normally a request is marked Completed automatically when the
// user actually finishes the reset-password flow.
export const markResetRequestCompleted = async (req, res, next) => {
  try {
    const request = await PasswordResetRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found." });
    if (!["Approved", "Pending"].includes(request.status)) {
      return res.status(400).json({ message: `This request is already ${request.status.toLowerCase()}.` });
    }

    request.status = "Completed";
    request.completedAt = new Date();
    if (!request.reviewedBy) {
      request.reviewedAt = new Date();
      request.reviewedBy = req.userId;
    }
    request.resetTokenHash = undefined;
    request.resetTokenExpires = null;
    await request.save();

    res.json({ message: "Request marked as completed.", request });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/stats (auth + adminOnly)
// Overview data for the Admin Dashboard. Everything here is computed live
// from the real collections — no mock/demo numbers.
export const getAdminStats = async (req, res, next) => {
  try {
    const activeSince = new Date(Date.now() - ACTIVE_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      totalTasks,
      completedTasks,
      pendingTasks,
      usersWithActiveStreak,
      longestStreakHolder,
      recentActivityRaw,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ lastLoginAt: { $gte: activeSince } }),
      Schedule.countDocuments({}),
      Schedule.countDocuments({ status: "Finished" }),
      Schedule.countDocuments({ status: "Pending" }),
      User.countDocuments({ currentStreak: { $gt: 0 } }),
      User.findOne({ longestStreak: { $gt: 0 } }).sort({ longestStreak: -1 }).select("name longestStreak"),
      ActivityLog.find({}).sort({ createdAt: -1 }).limit(15).populate("userId", "name email"),
    ]);

    const recentActivity = recentActivityRaw.map((a) => ({
      id: a._id,
      type: a.type,
      title: a.title,
      description: a.description,
      createdAt: a.createdAt,
      user: a.userId ? { name: a.userId.name, email: a.userId.email } : null,
    }));

    res.json({
      totalUsers,
      activeUsers,
      activeUserWindowDays: ACTIVE_USER_WINDOW_DAYS,
      totalTasks,
      completedTasks,
      pendingTasks,
      usersWithActiveStreak,
      longestStreakOverall: longestStreakHolder
        ? { days: longestStreakHolder.longestStreak, userName: longestStreakHolder.name }
        : null,
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
};

// "Active" = logged in more recently than they logged out, within this
// window of their last activity. Shared by the list + filter + detail views
// so status is computed identically everywhere.
const ACTIVE_WINDOW_MINUTES = 15;

const computeStatus = (u, now = Date.now()) => {
  const loggedInMoreRecently = u.lastLoginAt && (!u.lastLogoutAt || u.lastLoginAt > u.lastLogoutAt);
  const recentlyActive =
    u.lastLoginAt && now - new Date(u.lastLoginAt).getTime() < ACTIVE_WINDOW_MINUTES * 60 * 1000;
  return loggedInMoreRecently && recentlyActive ? "Active" : loggedInMoreRecently ? "Logged In" : "Offline";
};

// GET /api/admin/users?status=Active|LoggedIn|Offline|Recent — Users
// Management list. Never includes password hashes or any private note/task
// content — only account + auth-activity metadata, plus lightweight counts
// (sheets, preparation topics) reused from the existing academy/track
// models, per the admin-privacy requirement.
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({})
      .select("name email role createdAt lastLoginAt lastLogoutAt currentStreak longestStreak")
      .sort({ createdAt: -1 });

    const userIds = users.map((u) => u._id);

    const [sheetCounts, topicCounts] = await Promise.all([
      AcademyFile.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
      ]),
      TrackTopic.aggregate([
        { $match: { userId: { $in: userIds } } },
        {
          $group: {
            _id: "$userId",
            total: { $sum: 1 },
            completed: { $sum: { $cond: ["$completed", 1, 0] } },
          },
        },
      ]),
    ]);

    const sheetsByUser = new Map(sheetCounts.map((s) => [String(s._id), s.count]));
    const topicsByUser = new Map(topicCounts.map((t) => [String(t._id), { total: t.total, completed: t.completed }]));

    const now = Date.now();
    let list = users.map((u) => {
      const status = computeStatus(u, now);
      const prep = topicsByUser.get(String(u._id)) || { total: 0, completed: 0 };

      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        lastLogoutAt: u.lastLogoutAt,
        currentStreak: u.currentStreak,
        longestStreak: u.longestStreak,
        status,
        sheetsCount: sheetsByUser.get(String(u._id)) || 0,
        prepTopicsTotal: prep.total,
        prepTopicsCompleted: prep.completed,
      };
    });

    // Optional server-side status filter — "Active"/"Logged In"/"Offline" map
    // directly to computeStatus(); "Recent" = any login activity in the last
    // 7 days (same window the Overview "Active Users" stat uses).
    const { status } = req.query;
    if (status && status !== "all") {
      if (status === "Recent") {
        const recentSince = Date.now() - ACTIVE_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        list = list.filter((u) => u.lastLoginAt && new Date(u.lastLoginAt).getTime() >= recentSince);
      } else {
        list = list.filter((u) => u.status === status);
      }
    }

    res.json({ users: list });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/users/:id — full detail view for a single user (Users
// Management "view details" action). Reuses existing models only; no
// passwords, hashes, or note/schedule content are ever included.
export const getUserDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name email role accountStatus createdAt lastLoginAt lastLogoutAt currentStreak longestStreak mustChangePassword"
    );
    if (!user) return res.status(404).json({ message: "User not found." });

    const [sheetsCount, topicsAgg, categoriesCount, recentActivity] = await Promise.all([
      AcademyFile.countDocuments({ userId: user._id }),
      TrackTopic.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: ["$completed", 1, 0] } } } },
      ]),
      TrackCategory.countDocuments({ userId: user._id }),
      ActivityLog.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10),
    ]);

    const prep = topicsAgg[0] || { total: 0, completed: 0 };

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        lastLogoutAt: user.lastLogoutAt,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        mustChangePassword: user.mustChangePassword,
        status: computeStatus(user),
      },
      preparation: {
        categoriesCount,
        topicsTotal: prep.total,
        topicsCompleted: prep.completed,
        percent: prep.total ? Math.round((prep.completed / prep.total) * 100) : 0,
      },
      sheetsCount,
      recentActivity: recentActivity.map((a) => ({
        id: a._id,
        type: a.type,
        title: a.title,
        description: a.description,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/users/:id/reset-password
// Admin-initiated reset directly from the Users page (no prior user request
// needed): generates a brand-new secure password and emails it directly to
// the user's registered address (real SMTP delivery via utils/email.js —
// never simulated).
//
// IMPORTANT: the user's password in the database is only changed if the
// email actually sends successfully. That keeps success/failure honest —
// the frontend must never show "Mail Sent" for an email that didn't go
// out — and it also means a failed attempt never locks the user out of an
// account whose new password they never received. On failure the admin can
// simply retry.
export const adminResetUserPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const request = await PasswordResetRequest.create({
      userId: user._id,
      email: user.email,
      status: "Pending",
      requestIp: req.ip,
    });

    if (!isEmailConfigured()) {
      request.status = "Rejected";
      request.rejectionReason = "Email is not configured (EMAIL_SERVER/EMAIL_FROM missing).";
      request.reviewedAt = new Date();
      request.reviewedBy = req.userId;
      await request.save();

      return res.status(502).json({
        message: "Failed to send password reset email. Please try again.",
        emailSent: false,
      });
    }

    const newPassword = generateTempPassword();

    const emailResult = await sendMail({
      to: user.email,
      subject: "Cloud Prep – Password Reset",
      text: `Hello ${user.name},\n\nYour Cloud Prep account password has been reset by the administrator.\n\nYour new password is: ${newPassword}\n\nPlease use this password to log in to your Cloud Prep account. You will be asked to set a new password after signing in.\n\nRegards,\nCloud Prep Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <h2 style="color: #db2777;">Cloud Prep – Password Reset</h2>
          <p>Hello ${user.name},</p>
          <p>Your Cloud Prep account password has been reset by the administrator.</p>
          <p style="margin: 20px 0;">Your new password is:</p>
          <p style="font-family: monospace; font-size: 18px; font-weight: bold; background: #f3f4f6; padding: 10px 14px; border-radius: 8px; display: inline-block;">${newPassword}</p>
          <p style="margin-top: 20px;">Please use this password to log in to your Cloud Prep account. You will be asked to set a new password after signing in.</p>
          <p>Regards,<br/>Cloud Prep Team</p>
        </div>
      `,
    });

    if (!emailResult.sent) {
      // Nothing was persisted for the user — old password still works, and
      // the audit trail records the failed attempt for visibility.
      request.status = "Rejected";
      request.rejectionReason = emailResult.reason || "Email delivery failed.";
      request.reviewedAt = new Date();
      request.reviewedBy = req.userId;
      await request.save();

      return res.status(502).json({
        message: "Failed to send password reset email. Please try again.",
        emailSent: false,
      });
    }

    // Email confirmed sent — now it's safe to actually change the password.
    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = true;
    user.tokenVersion += 1; // invalidate any of the user's existing sessions
    await user.save();

    request.status = "Completed";
    request.method = "temporary_password";
    request.reviewedAt = new Date();
    request.reviewedBy = req.userId;
    request.completedAt = new Date();
    await request.save();

    res.json({
      message: "Password reset email sent successfully.",
      emailSent: true,
    });
  } catch (err) {
    next(err);
  }
};
