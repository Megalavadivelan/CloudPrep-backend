import express from "express";
import {
  listResetRequests,
  getResetRequest,
  approveResetRequest,
  issueTempPassword,
  rejectResetRequest,
  markResetRequestCompleted,
  getAdminStats,
  getAllUsers,
  getUserDetails,
  adminResetUserPassword,
} from "../controllers/adminController.js";
import auth from "../middleware/auth.js";
import adminOnly from "../middleware/adminOnly.js";

const router = express.Router();

// Every route here requires a valid session AND an admin role — enforced
// server-side, not just hidden in the frontend.
router.use(auth, adminOnly);

router.get("/stats", getAdminStats);

router.get("/users", getAllUsers);
router.get("/users/:id", getUserDetails);
router.post("/users/:id/reset-password", adminResetUserPassword);

router.get("/password-reset-requests", listResetRequests);
router.get("/password-reset-requests/:id", getResetRequest);
router.post("/password-reset-requests/:id/approve", approveResetRequest);
router.post("/password-reset-requests/:id/temp-password", issueTempPassword);
router.post("/password-reset-requests/:id/reject", rejectResetRequest);
router.post("/password-reset-requests/:id/complete", markResetRequestCompleted);

export default router;
