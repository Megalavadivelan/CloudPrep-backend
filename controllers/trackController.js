import mongoose from "mongoose";
import TrackCategory from "../models/TrackCategory.js";
import TrackTopic from "../models/TrackTopic.js";
import { logActivity } from "./activityController.js";

const ACTIVITY_TYPE = {
  placement: "PLACEMENT_PROGRESS",
  gate: "GATE_PROGRESS",
  courses: "COURSE_PROGRESS",
  custom: "CUSTOM_PROGRESS",
};

// "custom" = user-created Preparation categories (Preparation section) —
// same category/topic shape as placement/gate/courses, just user-named.
const TYPES = ["placement", "gate", "courses", "custom"];

const isValidType = (type) => TYPES.includes(type);

// Strict server-side cap on user-created Preparation categories (type
// "custom"). Enforced here — not just hidden/disabled on the frontend — so
// it can't be bypassed by calling the API directly.
const MAX_CUSTOM_PREPARATIONS = 10;

// ---------- Categories (Placement categories / GATE subjects / Courses) ----------

export const createCategory = async (req, res, next) => {
  try {
    const { type, name } = req.body;
    if (!isValidType(type)) return res.status(400).json({ message: "Invalid tracker type." });
    const trimmedName = (name || "").trim();
    if (!trimmedName) return res.status(400).json({ message: "Category name is required." });

    if (type === "custom") {
      const existingCount = await TrackCategory.countDocuments({ userId: req.userId, type: "custom" });
      if (existingCount >= MAX_CUSTOM_PREPARATIONS) {
        return res.status(400).json({ message: `Maximum ${MAX_CUSTOM_PREPARATIONS} preparations reached.` });
      }
    }

    // Case-insensitive duplicate check, scoped to this user + type, so the
    // same person can't accidentally create "Python Preparation" twice.
    const duplicate = await TrackCategory.findOne({
      userId: req.userId,
      type,
      name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
    if (duplicate) return res.status(400).json({ message: "A preparation with this name already exists." });

    const category = await TrackCategory.create({ userId: req.userId, type, name: trimmedName });
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
};

export const getCategories = async (req, res, next) => {
  try {
    const { type } = req.query;
    const query = { userId: req.userId };
    if (type) {
      if (!isValidType(type)) return res.status(400).json({ message: "Invalid tracker type." });
      query.type = type;
    }
    const categories = await TrackCategory.find(query).sort({ createdAt: 1 });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const category = await TrackCategory.findOne({ _id: req.params.id, userId: req.userId });
    if (!category) return res.status(404).json({ message: "Category not found." });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Category name is required." });
    category.name = name.trim();

    await category.save();
    res.json({ category });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const category = await TrackCategory.findOne({ _id: req.params.id, userId: req.userId });
    if (!category) return res.status(404).json({ message: "Category not found." });

    // Deleting a category also removes its own topics only (no unrelated data touched).
    await TrackTopic.deleteMany({ categoryId: category._id, userId: req.userId });
    await category.deleteOne();

    res.json({ message: "Category deleted successfully." });
  } catch (err) {
    next(err);
  }
};

// ---------- Topics (day-wise schedule items with checkboxes) ----------

export const createTopics = async (req, res, next) => {
  try {
    const { type, categoryId } = req.body;
    if (!isValidType(type)) return res.status(400).json({ message: "Invalid tracker type." });
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "A valid category is required." });
    }

    const category = await TrackCategory.findOne({ _id: categoryId, userId: req.userId, type });
    if (!category) return res.status(404).json({ message: "Category not found." });

    const items = Array.isArray(req.body.items) ? req.body.items : [req.body];
    if (!items.length) return res.status(400).json({ message: "At least one topic is required." });

    for (const item of items) {
      if (!item.date || !item.title || !item.title.trim()) {
        return res.status(400).json({ message: "Each topic needs a date and a title." });
      }
    }

    const VALID_PRIORITIES = ["low", "medium", "high"];
    const docs = items.map((item) => ({
      userId: req.userId,
      type,
      categoryId,
      date: item.date,
      title: item.title.trim(),
      description: item.description || "",
      priority: VALID_PRIORITIES.includes(item.priority) ? item.priority : "medium",
      completed: !!item.completed,
    }));

    const created = await TrackTopic.insertMany(docs);
    res.status(201).json({ topics: created });
  } catch (err) {
    next(err);
  }
};

export const getTopics = async (req, res, next) => {
  try {
    const { type, categoryId, date } = req.query;
    const query = { userId: req.userId };
    if (type) {
      if (!isValidType(type)) return res.status(400).json({ message: "Invalid tracker type." });
      query.type = type;
    }
    if (categoryId) query.categoryId = categoryId;
    if (date) query.date = date;

    const topics = await TrackTopic.find(query).sort({ date: 1, createdAt: 1 });
    res.json({ topics });
  } catch (err) {
    next(err);
  }
};

export const updateTopic = async (req, res, next) => {
  try {
    const topic = await TrackTopic.findOne({ _id: req.params.id, userId: req.userId });
    if (!topic) return res.status(404).json({ message: "Topic not found." });

    const { date, title, description, completed, categoryId, priority } = req.body;
    const wasCompleted = topic.completed;

    if (categoryId && categoryId !== String(topic.categoryId)) {
      const category = await TrackCategory.findOne({ _id: categoryId, userId: req.userId, type: topic.type });
      if (!category) return res.status(404).json({ message: "Target category not found." });
      topic.categoryId = categoryId;
    }
    if (date) topic.date = date;
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: "Topic title cannot be empty." });
      topic.title = title.trim();
    }
    if (description !== undefined) topic.description = description;
    if (priority !== undefined && ["low", "medium", "high"].includes(priority)) topic.priority = priority;
    if (completed !== undefined) topic.completed = !!completed;

    await topic.save();

    // Only log a meaningful update when the completion checkbox actually flips.
    if (completed !== undefined && wasCompleted !== topic.completed && topic.completed) {
      await logActivity(
        req.userId,
        ACTIVITY_TYPE[topic.type] || "ACADEMIC_UPDATE",
        `Completed ${topic.title}`,
        "",
        { topicId: topic._id, type: topic.type }
      );
    }

    res.json({ topic });
  } catch (err) {
    next(err);
  }
};

export const deleteTopic = async (req, res, next) => {
  try {
    const topic = await TrackTopic.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!topic) return res.status(404).json({ message: "Topic not found." });
    res.json({ message: "Topic deleted successfully." });
  } catch (err) {
    next(err);
  }
};

// ---------- Combined summary (used by Dashboard) ----------

export const getSummary = async (req, res, next) => {
  try {
    const [categories, topics] = await Promise.all([
      TrackCategory.find({ userId: req.userId }),
      TrackTopic.find({ userId: req.userId }),
    ]);
    res.json({ categories, topics });
  } catch (err) {
    next(err);
  }
};
