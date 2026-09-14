import User from "../models/User.js";
import { todayKey } from "../utils/streak.js";

// GET /api/streak/me (protected)
// Reads the cached streak fields on the user (kept in sync by
// services/streakService.js whenever a task's completion status changes)
// and derives the two booleans the frontend needs for the dashboard card
// and the "at risk" reminder banner.
export const getMyStreak = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select(
      "currentStreak longestStreak streakStartDate lastCompletedDate"
    );
    if (!user) return res.status(404).json({ message: "User not found." });

    const today = todayKey();
    const todayCompleted = user.lastCompletedDate === today;
    const atRisk = user.currentStreak > 0 && !todayCompleted;

    res.json({
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      streakStartDate: user.streakStartDate,
      lastCompletedDate: user.lastCompletedDate,
      todayCompleted,
      atRisk,
    });
  } catch (err) {
    next(err);
  }
};
