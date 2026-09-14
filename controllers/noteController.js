import Note from "../models/Note.js";

export const createNote = async (req, res, next) => {
  try {
    const { title, content } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Note title is required." });
    }
    const note = await Note.create({ userId: req.userId, title: title.trim(), content: content || "" });
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
};

export const getNotes = async (req, res, next) => {
  try {
    const notes = await Note.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json({ notes });
  } catch (err) {
    next(err);
  }
};

export const getNoteById = async (req, res, next) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) return res.status(404).json({ message: "Note not found." });
    res.json({ note });
  } catch (err) {
    next(err);
  }
};

export const updateNote = async (req, res, next) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) return res.status(404).json({ message: "Note not found." });

    const { title, content } = req.body;
    if (title !== undefined) note.title = title.trim();
    if (content !== undefined) note.content = content;

    await note.save();
    res.json({ note });
  } catch (err) {
    next(err);
  }
};

export const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!note) return res.status(404).json({ message: "Note not found." });
    res.json({ message: "Note deleted successfully." });
  } catch (err) {
    next(err);
  }
};
