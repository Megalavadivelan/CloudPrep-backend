import express from "express";
import {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  createTopics,
  getTopics,
  updateTopic,
  deleteTopic,
  getSummary,
} from "../controllers/trackController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.get("/summary", getSummary);

router.post("/categories", createCategory);
router.get("/categories", getCategories);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

router.post("/topics", createTopics);
router.get("/topics", getTopics);
router.put("/topics/:id", updateTopic);
router.delete("/topics/:id", deleteTopic);

export default router;
