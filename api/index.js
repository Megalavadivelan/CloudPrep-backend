import dotenv from "dotenv";
import app from "../app.js";
import connectDB from "../config/db.js";

dotenv.config();

// ---------------------------------------------------------------------------
// Vercel entry point. Vercel auto-detects any file under /api as a
// serverless function; vercel.json rewrites every request path to this file,
// which just connects to Mongo (reusing the cached connection from
// config/db.js when the container is warm) and hands the request to the
// same Express app used by server.js for local/traditional hosting.
//
// Not used: node-cron (see routes/cronRoutes.js + vercel.json "crons"
// instead) and local disk file uploads (see the note in app.js).
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    return res.status(500).json({ message: "Database connection failed." });
  }
  return app(req, res);
}
