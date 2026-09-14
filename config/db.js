import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Connection is cached across invocations. This matters most in a serverless
// environment (Vercel): each function invocation can reuse a warm container,
// and without this cache every request would open a brand new MongoDB
// connection and quickly exhaust Atlas's connection limit. It's a no-op cost
// for traditional always-on hosting (Render/Railway/local) too.
// ---------------------------------------------------------------------------
let cached = global._mongooseConn;
if (!cached) cached = global._mongooseConn = { conn: null, promise: null };

const connectDB = async () => {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not defined in .env");

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((m) => {
        console.log("✅ MongoDB connected");
        return m;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
};

export default connectDB;
