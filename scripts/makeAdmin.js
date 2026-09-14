/**
 * One-time CLI helper to promote an existing registered user to admin.
 * No admin credentials are ever hardcoded — you must already have a
 * registered CloudPrep account for the email you pass in.
 *
 * Usage (from the backend/ directory):
 *   node scripts/makeAdmin.js user@example.com
 *
 * Requires the same .env (MONGO_URI) as the running server.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const run = async () => {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/makeAdmin.js <email>");
    process.exit(1);
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not defined in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error(`No account found for ${email}. The user must sign up first.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (user.role === "admin") {
    console.log(`${user.email} is already an admin.`);
  } else {
    user.role = "admin";
    // Force re-login everywhere so the new role takes effect immediately.
    user.tokenVersion += 1;
    await user.save();
    console.log(`✅ ${user.email} is now an admin. They should log in again to pick up the change.`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("Failed to promote user:", err.message);
  process.exit(1);
});
