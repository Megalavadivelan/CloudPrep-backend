import mongoose from "mongoose";

const CATEGORIES = ["academic", "placement", "gate", "courses", "certificates", "notes", "others"];

const academyFileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    category: { type: String, enum: CATEGORIES, default: "others" },
  },
  { timestamps: true }
);

export const ACADEMY_CATEGORIES = CATEGORIES;
export default mongoose.model("AcademyFile", academyFileSchema);
