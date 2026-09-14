import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads", "academy");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 60);
    cb(null, `${req.userId}-${Date.now()}-${safeBase}${ext}`);
  },
});

// Broad set of academic file types: documents, spreadsheets, slides, images, archives, text
const allowedExt = /pdf|docx?|pptx?|xlsx?|txt|rtf|jpe?g|png|webp|gif|zip|rar|csv|md/i;

const fileFilter = (req, file, cb) => {
  const extOk = allowedExt.test(path.extname(file.originalname).toLowerCase());
  if (extOk) cb(null, true);
  else cb(new Error("That file type isn't supported. Try PDF, Word, Excel, PowerPoint, images, text, or zip files."));
};

const academyUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB per file
});

export default academyUpload;
