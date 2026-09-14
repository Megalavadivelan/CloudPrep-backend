import mongoose from "mongoose";

// A "topic" is one day-wise study item inside a category/subject/course.
// Same shared-model approach as TrackCategory: Placement, GATE and Courses
// all need identical fields, so one collection + a `type` discriminator
// keeps the tracking architecture genuinely identical across all three.
const trackTopicSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // "custom" = user-created Preparation topics (Preparation section) —
    // must stay in sync with TrackCategory's type enum, which already
    // includes it.
    type: { type: String, enum: ["placement", "gate", "courses", "custom"], required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "TrackCategory", required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    // Used by the Dashboard's Today's Plan / Upcoming Preparation sections
    // to surface how urgent a preparation task is. Defaults to "medium" so
    // older topics created before this field existed still render sensibly.
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

trackTopicSchema.index({ userId: 1, type: 1, date: 1 });
trackTopicSchema.index({ userId: 1, categoryId: 1 });

export default mongoose.model("TrackTopic", trackTopicSchema);
