import mongoose from "mongoose";

/**
 * A password reset request created when a user submits "Forgot Password?".
 * An admin reviews it in the Admin Panel and either:
 *   - approves it -> generates a single-use, expiring reset token, OR
 *   - issues a temporary password directly, OR
 *   - rejects it.
 *
 * Only a SHA-256 hash of the reset token is ever stored (never the raw
 * token) — same principle as password hashing. The raw token is returned
 * exactly once, in the API response to the admin who approved the request,
 * so it can be handed to the user through a secure out-of-band channel.
 */
const passwordResetRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Completed", "Expired"],
      default: "Pending",
      index: true,
    },

    // Populated once an admin approves via the token flow.
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpires: { type: Date, default: null },

    // Populated once an admin approves via the temporary-password flow.
    method: { type: String, enum: ["link", "temporary_password", null], default: null },

    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: "" },

    completedAt: { type: Date, default: null },

    // Basic anti-abuse context — not exposed to the requester.
    requestIp: { type: String, default: "" },
  },
  { timestamps: true }
);

passwordResetRequestSchema.index({ userId: 1, status: 1 });

export default mongoose.model("PasswordResetRequest", passwordResetRequestSchema);
