import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import trackRoutes from "./routes/trackRoutes.js";
import academyRoutes from "./routes/academyRoutes.js";
import cgpaRoutes from "./routes/cgpaRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import streakRoutes from "./routes/streakRoutes.js";
import cronRoutes from "./routes/cronRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ---------------------------------------------------------------------------
// CORS: CLIENT_URL can be a single origin or a comma-separated list (handy on
// Vercel where you'll usually want both your production domain and preview
// deployment URLs allowed at once), e.g.:
//   CLIENT_URL=https://your-app.vercel.app,https://your-app-git-main.vercel.app
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, server-to-server, health checks)
      // that don't send an Origin header at all.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

// NOTE: this only serves files that exist on the current instance's local
// disk. On Vercel's serverless functions that disk is ephemeral, so files
// uploaded via multer (see middleware/upload.js, middleware/academyUpload.js)
// will NOT persist or be reliably servable in that environment. This is
// fine for local dev / traditional hosting (Render, Railway, a VPS, etc.);
// switch multer's storage to a cloud provider (e.g. Cloudinary, S3, Vercel
// Blob) before relying on file uploads in production on Vercel.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/tracks", trackRoutes);
app.use("/api/academy", academyRoutes);
app.use("/api/cgpa", cgpaRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/streak", streakRoutes);
app.use("/api/cron", cronRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
