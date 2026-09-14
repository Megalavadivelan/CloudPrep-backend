import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    grade: { type: String, default: "" },
    gradePoint: { type: Number, default: 0 },
    credits: { type: Number, default: 0 },
  },
  { _id: false }
);

const semesterSchema = new mongoose.Schema(
  {
    semesterNumber: { type: Number, required: true },
    subjects: { type: [subjectSchema], default: [] },
  },
  { _id: false }
);

const gradeScaleItemSchema = new mongoose.Schema(
  {
    grade: { type: String, required: true },
    point: { type: Number, required: true },
  },
  { _id: false }
);

const cgpaProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    semesters: { type: [semesterSchema], default: [] },
    overallMode: { type: String, enum: ["weighted", "average"], default: "weighted" },
    gradeScale: {
      type: [gradeScaleItemSchema],
      default: [
        { grade: "O", point: 10 },
        { grade: "A+", point: 9 },
        { grade: "A", point: 8 },
        { grade: "B+", point: 7 },
        { grade: "B", point: 6 },
        { grade: "C", point: 5 },
        { grade: "U / RA", point: 0 },
      ],
    },
  },
  { timestamps: true }
);

export default mongoose.model("CgpaProfile", cgpaProfileSchema);
