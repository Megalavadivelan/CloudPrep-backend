import express from "express";
import {
  createSchedules,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
} from "../controllers/scheduleController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.post("/", createSchedules);
router.get("/", getSchedules);
router.get("/:id", getScheduleById);
router.put("/:id", updateSchedule);
router.delete("/:id", deleteSchedule);

export default router;
