import mongoose from "mongoose";

// A single reusable "category" model that powers Placement categories,
// GATE subjects, and Courses — they all need the same shape (name + type),
// so one collection avoids duplicating three near-identical models.
const trackCategorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // "custom" powers the user-defined Preparation categories (Preparation
    // section) — same shape as placement/gate/courses, just user-named.
    type: { type: String, enum: ["placement", "gate", "courses", "custom"], required: true, index: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

trackCategorySchema.index({ userId: 1, type: 1 });

export default mongoose.model("TrackCategory", trackCategorySchema);
