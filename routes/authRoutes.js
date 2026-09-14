import express from "express";
import {
  signup,
  login,
  logout,
  getProfile,
  updateProfile,
  uploadResumeFile,
  deleteResumeFile,
  forgotPassword,
  resetPassword,
  changePassword,
  adminVerify,
} from "../controllers/authController.js";
import auth from "../middleware/auth.js";
import upload, { uploadResume } from "../middleware/upload.js";
import { authLimiter, forgotPasswordLimiter, resetPasswordLimiter, adminVerifyLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/logout", auth, logout);
router.post("/admin-verify", adminVerifyLimiter, adminVerify);

router.get("/profile", auth, getProfile);
router.put("/profile", auth, upload.single("profileImage"), updateProfile);
router.post("/profile/resume", auth, uploadResume.single("resume"), uploadResumeFile);
router.delete("/profile/resume", auth, deleteResumeFile);

router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPasswordLimiter, resetPassword);
router.post("/change-password", auth, changePassword);

export default router;
