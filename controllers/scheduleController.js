import Schedule from "../models/Schedule.js";
import { recomputeStreak } from "../services/streakService.js";
import { logActivity } from "./activityController.js";

// Accepts either a single schedule body, or { items: [...] } for bulk creation
export const createSchedules = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [req.body];

    if (!items.length) {
      return res.status(400).json({ message: "At least one schedule item is required." });
    }

    for (const item of items) {
      if (!item.date || !item.day || !item.title) {
        return res.status(400).json({ message: "Each schedule needs a date, day, and title." });
      }
    }

    const docs = items.map((item) => ({
      userId: req.userId,
      date: item.date,
      day: item.day,
      title: item.title.trim(),
      description: item.description || "",
      status: item.status === "Finished" ? "Finished" : "Pending",
    }));

    const created = await Schedule.insertMany(docs);

    // Bulk-created items can already arrive marked Finished (e.g. an
    // import); keep the streak cache in sync either way.
    if (created.some((s) => s.status === "Finished")) {
      await recomputeStreak(req.userId);
    }

    res.status(201).json({ schedules: created });
  } catch (err) {
    next(err);
  }
};

export const getSchedules = async (req, res, next) => {
  try {
    const { status, search, date } = req.query;
    const query = { userId: req.userId };

    if (status && status !== "All") query.status = status;
    if (date) query.date = date;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { date: { $regex: search, $options: "i" } },
      ];
    }

    const schedules = await Schedule.find(query).sort({ date: 1, createdAt: -1 });
    res.json({ schedules });
  } catch (err) {
    next(err);
  }
};

export const getScheduleById = async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({ _id: req.params.id, userId: req.userId });
    if (!schedule) return res.status(404).json({ message: "Schedule not found." });
    res.json({ schedule });
  } catch (err) {
    next(err);
  }
};

export const updateSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({ _id: req.params.id, userId: req.userId });
    if (!schedule) return res.status(404).json({ message: "Schedule not found." });

    const { date, day, title, description, status } = req.body;
    const previousStatus = schedule.status;

    if (date) schedule.date = date;
    if (day) schedule.day = day;
    if (title) schedule.title = title.trim();
    if (description !== undefined) schedule.description = description;
    if (status && ["Pending", "Finished"].includes(status)) schedule.status = status;

    await schedule.save();

    // Keep the streak cache in sync whenever a task's completion status
    // actually changed (covers marking done AND un-marking it), and log a
    // "task completed" activity entry — this feeds both a future per-user
    // activity feed and the Admin Dashboard's global Recent Activity list.
    if (status && status !== previousStatus) {
      await recomputeStreak(req.userId);
      if (status === "Finished") {
        await logActivity(req.userId, "TASK_COMPLETED", schedule.title, `Completed on ${schedule.date}`, {
          scheduleId: schedule._id,
          date: schedule.date,
        });
      }
    }

    res.json({ schedule });
  } catch (err) {
    next(err);
  }
};

export const deleteSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!schedule) return res.status(404).json({ message: "Schedule not found." });

    // Removing a completed task can change which dates still count toward
    // the streak, so recompute from what's actually left in the database.
    if (schedule.status === "Finished") {
      await recomputeStreak(req.userId);
    }

    res.json({ message: "Schedule deleted successfully." });
  } catch (err) {
    next(err);
  }
};
