import CgpaProfile from "../models/CgpaProfile.js";
import { logActivity } from "./activityController.js";

// Local mirror of the credit-weighted formula (kept in sync with
// frontend/src/utils/academyUtils.js) so we can detect a *meaningful*
// CGPA change server-side without pulling in frontend code.
const computeOverall = (semesters = []) => {
  const withData = semesters.filter((s) => (s.subjects || []).some((sub) => Number(sub.credits) > 0));
  if (!withData.length) return 0;
  let totalCredits = 0;
  let totalWeighted = 0;
  withData.forEach((s) => {
    (s.subjects || []).forEach((sub) => {
      const credits = Number(sub.credits) || 0;
      if (credits > 0) {
        totalCredits += credits;
        totalWeighted += credits * (Number(sub.gradePoint) || 0);
      }
    });
  });
  return totalCredits > 0 ? totalWeighted / totalCredits : 0;
};

export const getCgpaProfile = async (req, res, next) => {
  try {
    let profile = await CgpaProfile.findOne({ userId: req.userId });
    if (!profile) {
      profile = await CgpaProfile.create({ userId: req.userId });
    }
    res.json({ profile });
  } catch (err) {
    next(err);
  }
};

export const saveCgpaProfile = async (req, res, next) => {
  try {
    const { semesters, overallMode, gradeScale } = req.body;

    if (semesters && !Array.isArray(semesters)) {
      return res.status(400).json({ message: "Semesters must be a list." });
    }
    if (overallMode && !["weighted", "average"].includes(overallMode)) {
      return res.status(400).json({ message: "Invalid overall CGPA mode." });
    }

    // Guard against invalid/negative numbers corrupting stored data
    const cleanSemesters = (semesters || []).map((sem) => ({
      semesterNumber: Number(sem.semesterNumber) || 0,
      subjects: (sem.subjects || []).map((sub) => ({
        name: sub.name || "",
        grade: sub.grade || "",
        gradePoint: Math.max(0, Number(sub.gradePoint) || 0),
        credits: Math.max(0, Number(sub.credits) || 0),
      })),
    }));

    const before = await CgpaProfile.findOne({ userId: req.userId });
    const beforeOverall = before ? computeOverall(before.semesters) : 0;
    const afterOverall = computeOverall(cleanSemesters);

    const update = { semesters: cleanSemesters };
    if (overallMode) update.overallMode = overallMode;
    if (Array.isArray(gradeScale) && gradeScale.length) update.gradeScale = gradeScale;

    const profile = await CgpaProfile.findOneAndUpdate(
      { userId: req.userId },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Only log when the overall CGPA actually moved (rounded to 2dp) — avoids
    // spamming Recent Updates on every debounced autosave while the user types.
    if (Math.abs(beforeOverall - afterOverall) >= 0.005) {
      const activeSemester = cleanSemesters
        .filter((s) => s.subjects.some((sub) => Number(sub.credits) > 0))
        .sort((a, b) => b.semesterNumber - a.semesterNumber)[0];
      await logActivity(
        req.userId,
        "CGPA_UPDATE",
        activeSemester ? `Updated Semester ${activeSemester.semesterNumber} CGPA` : "Updated CGPA",
        `Overall CGPA is now ${afterOverall.toFixed(2)}`,
        { overallCgpa: afterOverall }
      );
    }

    res.json({ profile });
  } catch (err) {
    next(err);
  }
};
