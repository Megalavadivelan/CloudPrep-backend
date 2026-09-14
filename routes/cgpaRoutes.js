import express from "express";
import { getCgpaProfile, saveCgpaProfile } from "../controllers/cgpaController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.get("/", getCgpaProfile);
router.put("/", saveCgpaProfile);

export default router;
