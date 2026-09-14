// Central error handler - never leaks raw stack traces to the client
export const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

export const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err);

  if (err.name === "ValidationError") {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(", ") });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "That email is already registered." });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID format." });
  }
  if (err.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File is too large." : err.message || "File upload failed.";
    return res.status(400).json({ message });
  }
  if (err.message && /file type/i.test(err.message)) {
    return res.status(400).json({ message: err.message });
  }

  res.status(err.statusCode || 500).json({
    message: err.publicMessage || "Something went wrong on our end. Please try again.",
  });
};
