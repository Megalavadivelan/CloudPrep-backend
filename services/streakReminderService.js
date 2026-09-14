import User from "../models/User.js";
import { sendMail, isEmailConfigured } from "../utils/email.js";
import { todayKey } from "../utils/streak.js";

/**
 * Finds users whose streak is currently "at risk" (they have an active
 * streak but haven't completed today's activity yet) and sends each of
 * them at most one reminder email per day.
 *
 * De-duplication: `reminderSentForDate` is only set (and only checked)
 * here, and services/streakService.js clears it back to null the moment
 * the user completes today's task — so a user can never get two emails
 * for the same day, and a fresh warning can fire on a later at-risk day.
 *
 * If email isn't configured (no EMAIL_SERVER/EMAIL_FROM), this is a no-op —
 * the in-app "Streak Reminder" banner (StreakReminderBanner.jsx) still
 * covers the user regardless of whether email delivery is set up.
 */
export const sendStreakRiskReminders = async () => {
  if (!isEmailConfigured()) return { checked: 0, sent: 0 };

  const today = todayKey();
  const atRiskUsers = await User.find({
    currentStreak: { $gt: 0 },
    lastCompletedDate: { $ne: today },
    reminderSentForDate: { $ne: today },
  }).select("name email currentStreak");

  let sent = 0;
  for (const user of atRiskUsers) {
    const result = await sendMail({
      to: user.email,
      subject: "🔥 Your Study Streak Is About to End!",
      text:
        `Hi ${user.name},\n\n` +
        `Your current ${user.currentStreak}-day study streak is at risk.\n\n` +
        `Complete today's scheduled activity to keep your streak alive!\n\n` +
        `Don't break the streak. Keep going! 🔥`,
      html:
        `<p>Hi ${user.name},</p>` +
        `<p>Your current <strong>${user.currentStreak}-day</strong> study streak is at risk.</p>` +
        `<p>Complete today's scheduled activity to keep your streak alive!</p>` +
        `<p>Don't break the streak. Keep going! 🔥</p>`,
    });

    // Mark as sent-for-today regardless of transient delivery failure, so a
    // failing SMTP server can't cause this job to hammer it every run.
    await User.findByIdAndUpdate(user._id, { reminderSentForDate: today });
    if (result.sent) sent += 1;
  }

  return { checked: atRiskUsers.length, sent };
};
