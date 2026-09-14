import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Verifies the JWT AND checks it against the user's current tokenVersion.
// tokenVersion is bumped on logout and on password change/reset, so a token
// issued before that moment stops working immediately — real server-side
// session invalidation despite the stateless JWT design.
const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided. Please log in." });
    }
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("tokenVersion role mustChangePassword");
    if (!user) {
      return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
    }
    if (typeof decoded.tv !== "number" || decoded.tv !== user.tokenVersion) {
      return res.status(401).json({ message: "Your session has ended. Please log in again." });
    }

    req.userId = decoded.id;
    req.userRole = user.role;
    req.mustChangePassword = user.mustChangePassword;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
  }
};

export default auth;
