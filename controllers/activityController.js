import ActivityLog from "../models/ActivityLog.js";

// GET /api/activity — most recent academic updates for the Dashboard.
export const getRecentActivity = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const query = { userId: req.userId };

    // Optional ?type=CUSTOM_PROGRESS or ?type=CUSTOM_PROGRESS,TASK_COMPLETED
    // so callers (e.g. the Dashboard's Recent Preparation Activity section)
    // can scope the feed to just the activity types they care about.
    if (req.query.type) {
      const types = String(req.query.type)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (types.length) query.type = { $in: types };
    }

    const activity = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ activity });
  } catch (err) {
    next(err);
  }
};

/**
 * Internal helper (not a route) other controllers call to record a
 * meaningful academic update. Never throws — a logging failure should
 * never break the primary action (saving CGPA, checking off a topic, etc).
 */
export const logActivity = async (userId, type, title, description = "", metadata = {}) => {
  try {
    await ActivityLog.create({ userId, type, title, description, metadata });
  } catch (err) {
    console.error("Failed to log activity:", err.message);
  }
};
