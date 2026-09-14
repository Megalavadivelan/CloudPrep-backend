import express from "express";
import { getMyStreak } from "../controllers/streakController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get("/me", auth, getMyStreak);

export default router;
