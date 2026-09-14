import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    profileImage: { type: String, default: "" },
    resume: { type: String, default: "" },
    resumeOriginalName: { type: String, default: "" },
    resumeUploadedAt: { type: Date, default: null },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // Bumped on logout and on any password change/reset so previously-issued
    // JWTs immediately stop working (see middleware/auth.js). This gives the
    // stateless JWT setup real server-side session invalidation without
    // needing a separate session store.
    tokenVersion: { type: Number, default: 0 },
    // Set true when an admin issues a temporary password. Forces the user
    // through the "create a new password" flow before they can reach the
    // rest of the app (see ProtectedRoute.jsx).
    mustChangePassword: { type: Boolean, default: false },

    // Used by the Admin Dashboard's "Active Users" stat (logged in within
    // the last 7 days).
    lastLoginAt: { type: Date, default: null },
    lastLogoutAt: { type: Date, default: null },

    // ---- Study/task completion streak ----
    // These are a CACHE, recomputed by services/streakService.js from the
    // user's actual Schedule completion dates every time a task's status
    // changes — never trust these fields as the sole source of truth, they
    // just make reads fast. Storing them (rather than deriving on every
    // page load) is what makes the streak survive refreshes, logout/login,
    // and other devices, per the spec's persistence requirement.
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    streakStartDate: { type: String, default: null }, // "YYYY-MM-DD" or null
    lastCompletedDate: { type: String, default: null }, // "YYYY-MM-DD" or null
    // Guards against sending more than one streak-risk email per day —
    // sees "YYYY-MM-DD" for the day a reminder was last sent, or null.
    reminderSentForDate: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
