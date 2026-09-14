import express from "express";
import { sendStreakRiskReminders } from "../services/streakReminderService.js";

const router = express.Router();

// ---------------------------------------------------------------------------
// Serverless platforms like Vercel don't keep a Node process running in the
// background, so the old `node-cron` schedule in server.js (which only runs
// under `npm run dev` / a traditional always-on host) can't fire there.
// Instead, this route is meant to be hit on a schedule by Vercel's own Cron
// Jobs feature (configured in vercel.json's "crons" array) or any external
// scheduler (cron-job.org, GitHub Actions, etc.) pointed at
// POST /api/cron/streak-reminders.
//
// It's protected by a shared secret (CRON_SECRET) so randoms on the internet
// can't trigger it — set the same value in your environment variables and in
// the scheduler's request headers.
// ---------------------------------------------------------------------------
router.post("/streak-reminders", async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    const provided = req.headers["x-cron-secret"] || req.query.secret;
    if (secret && provided !== secret) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    const result = await sendStreakRiskReminders();
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
