// Must run AFTER `auth` (relies on req.userRole set there). Enforces admin
// authorization on the SERVER — the frontend also hides admin UI, but that
// is a UX nicety only; this is the actual security boundary.
const adminOnly = (req, res, next) => {
  if (req.userRole !== "admin") {
    return res.status(403).json({ message: "You do not have permission to access this area." });
  }
  next();
};

export default adminOnly;
