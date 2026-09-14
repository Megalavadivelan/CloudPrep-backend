import Schedule from "../models/Schedule.js";
import User from "../models/User.js";
import { computeStreak, todayKey } from "../utils/streak.js";

/**
 * Recomputes a user's streak from their ACTUAL completed-task dates in the
 * database (never from frontend state) and caches the result on the User
 * document. Call this any time a Schedule item's completion status could
 * have changed (marked Finished, un-marked, or deleted).
 *
 * Returns the freshly computed streak fields.
 */
export const recomputeStreak = async (userId) => {
  const completedDateKeys = await Schedule.distinct("date", { userId, status: "Finished" });
  const { currentStreak, longestStreak, streakStartDate, lastCompletedDate } = computeStreak(completedDateKeys);

  const update = { currentStreak, longestStreak, streakStartDate, lastCompletedDate };

  // If today's activity is now done, clear any pending reminder flag so a
  // fresh warning can be sent again on a future at-risk day (item 11: reset
  // notification state once the user completes the day's activity).
  if (lastCompletedDate === todayKey()) {
    update.reminderSentForDate = null;
  }

  await User.findByIdAndUpdate(userId, update);
  return update;
};
