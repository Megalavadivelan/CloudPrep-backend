import express from "express";
import { uploadFile, getFiles, downloadFile, deleteFile } from "../controllers/academyController.js";
import auth from "../middleware/auth.js";
import academyUpload from "../middleware/academyUpload.js";

const router = express.Router();

router.use(auth);

router.post("/upload", academyUpload.single("file"), uploadFile);
router.get("/", getFiles);
router.get("/:id/download", downloadFile);
router.delete("/:id", deleteFile);

export default router;
