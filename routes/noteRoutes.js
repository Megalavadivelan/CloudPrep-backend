import express from "express";
import { createNote, getNotes, getNoteById, updateNote, deleteNote } from "../controllers/noteController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.post("/", createNote);
router.get("/", getNotes);
router.get("/:id", getNoteById);
router.put("/:id", updateNote);
router.delete("/:id", deleteNote);

export default router;
