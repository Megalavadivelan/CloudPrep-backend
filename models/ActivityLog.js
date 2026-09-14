import mongoose from "mongoose";

// Lightweight, reusable "recent activity" model that powers the Dashboard's
// Recent Updates feed. One shared collection with a `type` discriminator —
// same pattern already used for TrackCategory/TrackTopic — instead of a
// separate table per feature.
const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "CGPA_UPDATE",
        "GATE_PROGRESS",
        "PLACEMENT_PROGRESS",
        "COURSE_PROGRESS",
        "CALENDAR_UPDATE",
        "ACADEMIC_UPDATE",
        "TASK_COMPLETED",
        "CUSTOM_PROGRESS",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

activityLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("ActivityLog", activityLogSchema);
