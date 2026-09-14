import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true }, // stored as YYYY-MM-DD
    day: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["Pending", "Finished"], default: "Pending" },
  },
  { timestamps: true }
);

scheduleSchema.index({ userId: 1, date: 1 });

export default mongoose.model("Schedule", scheduleSchema);
