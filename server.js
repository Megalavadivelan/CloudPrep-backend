import dotenv from "dotenv";
import cron from "node-cron";
import app from "./app.js";
import connectDB from "./config/db.js";
import { sendStreakRiskReminders } from "./services/streakReminderService.js";

dotenv.config();

// ---------------------------------------------------------------------------
// This file is the entry point for local development (`npm run dev`) and for
// traditional always-on hosting (Render, Railway, a VPS, etc.) where a
// long-running Node process is the deployment model.
//
// It is NOT used when deploying to Vercel — Vercel instead invokes
// api/index.js per-request as a serverless function (see that file, and
// vercel.json). The two entry points share the same Express app (app.js) and
// the same cached DB connection helper (config/db.js), so behavior stays
// identical either way except for how the process is kept alive.
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

    // Checks for at-risk streaks and emails at most one reminder per user per
    // day (see services/streakReminderService.js for de-duplication). Runs
    // hourly; a no-op with no DB load beyond the query if EMAIL_SERVER isn't
    // configured. This assumes a single server instance — if you ever scale
    // to multiple instances, move this to a dedicated worker/queue so it
    // doesn't run (and double-send) once per instance.
    //
    // On Vercel, this whole block never runs — routes/cronRoutes.js +
    // vercel.json's "crons" entry take over that job instead.
    cron.schedule("0 * * * *", () => {
      sendStreakRiskReminders().catch((err) => console.error("Streak reminder job failed:", err.message));
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
