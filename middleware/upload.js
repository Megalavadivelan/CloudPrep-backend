import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.userId}-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
  if (ok) cb(null, true);
  else cb(new Error("Only image files are allowed (jpg, png, webp, gif)."));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ---------------------------------------------------------------------------
// Resume upload — separate config: PDF/DOC/DOCX up to 10MB, kept in the same
// uploads/ directory but with its own filter so profile-image validation
// doesn't reject document files (and vice versa).
// ---------------------------------------------------------------------------
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `resume-${req.userId}-${Date.now()}${ext}`);
  },
});

const resumeFileFilter = (req, file, cb) => {
  const allowedExt = /pdf|doc|docx/;
  const allowedMime = /pdf|msword|officedocument\.wordprocessingml/;
  const ok = allowedExt.test(path.extname(file.originalname).toLowerCase()) && allowedMime.test(file.mimetype);
  if (ok) cb(null, true);
  else cb(new Error("Only PDF, DOC, or DOCX files are allowed."));
};

export const uploadResume = multer({ storage: resumeStorage, fileFilter: resumeFileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

export default upload;
