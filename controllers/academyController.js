import fs from "fs";
import path from "path";
import os from "os";

import AcademyFile, {
  ACADEMY_CATEGORIES,
} from "../models/AcademyFile.js";

// Vercel serverless functions provide a temporary writable directory.
const uploadDir = path.join(os.tmpdir(), "academy");

const serialize = (doc) => ({
  id: doc._id,
  name: doc.originalName,
  mimeType: doc.mimeType,
  size: doc.size,
  category: doc.category,
  uploadedAt: doc.createdAt,
  url: `/uploads/academy/${doc.storedName}`,
});

// --------------------------------------------------
// Upload Academy File
// --------------------------------------------------

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please choose a file to upload.",
      });
    }

    const category = ACADEMY_CATEGORIES.includes(req.body.category)
      ? req.body.category
      : "others";

    const file = await AcademyFile.create({
      userId: req.userId,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      category,
    });

    res.status(201).json({
      file: serialize(file),
    });
  } catch (err) {
    next(err);
  }
};

// --------------------------------------------------
// Get Academy Files
// --------------------------------------------------

export const getFiles = async (req, res, next) => {
  try {
    const files = await AcademyFile.find({
      userId: req.userId,
    }).sort({
      createdAt: -1,
    });

    res.json({
      files: files.map(serialize),
    });
  } catch (err) {
    next(err);
  }
};

// --------------------------------------------------
// Download Academy File
// --------------------------------------------------

export const downloadFile = async (req, res, next) => {
  try {
    const file = await AcademyFile.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!file) {
      return res.status(404).json({
        message: "File not found.",
      });
    }

    const filePath = path.join(uploadDir, file.storedName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: "File is missing from storage.",
      });
    }

    res.download(filePath, file.originalName);
  } catch (err) {
    next(err);
  }
};

// --------------------------------------------------
// Delete Academy File
// --------------------------------------------------

export const deleteFile = async (req, res, next) => {
  try {
    const file = await AcademyFile.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!file) {
      return res.status(404).json({
        message: "File not found.",
      });
    }

    const filePath = path.join(uploadDir, file.storedName);

    fs.unlink(filePath, () => {});

    res.json({
      message: "File deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};
