import express from "express";
import { getRecentActivity } from "../controllers/activityController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.get("/", getRecentActivity);

export default router;
