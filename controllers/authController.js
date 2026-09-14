import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import os from "os";

import User from "../models/User.js";
import Schedule from "../models/Schedule.js";
import Note from "../models/Note.js";
import PasswordResetRequest from "../models/PasswordResetRequest.js";

import { validatePassword } from "../utils/validatePassword.js";
import { hashToken, generateSecureToken } from "../utils/tokens.js";
import { sendMail, isEmailConfigured } from "../utils/email.js";


// ============================================================
// SIGNUP
// ============================================================

export const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      return res.status(400).json({
        message: passwordError,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = jwt.sign(
      {
        id: user._id,
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      message: "Account created successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        resume: user.resume,
      },
    });
  } catch (err) {
    next(err);
  }
};


// ============================================================
// LOGIN
// ============================================================

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        resume: user.resume,
      },
    });
  } catch (err) {
    next(err);
  }
};


// ============================================================
// LOGOUT
// ============================================================

export const logout = async (req, res) => {
  res.json({
    message: "Logged out successfully.",
  });
};


// ============================================================
// VERIFY ADMIN
// ============================================================

export const verifyAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select(
      "-password"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    res.json({
      message: "Admin verified.",
      user,
    });
  } catch (err) {
    next(err);
  }
};


// ============================================================
// GET PROFILE
// ============================================================

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select(
      "-password"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    res.json({
      user,
    });
  } catch (err) {
    next(err);
  }
};


// ============================================================
// UPDATE PROFILE
// ============================================================

export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const { name, email } = req.body;

    if (name !== undefined) {
      user.name = name.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(409).json({
          message: "Email is already in use.",
        });
      }

      user.email = normalizedEmail;
    }

    if (req.file) {
      user.profileImage = `/uploads/${req.file.filename}`;
    }

    await user.save();

    res.json({
      message: "Profile updated successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        resume: user.resume,
      },
    });
  } catch (err) {
    next(err);
  }
};


// ============================================================
// UPLOAD RESUME
// ============================================================

export const uploadResume = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please choose a resume file.",
      });
    }

    // Delete previous resume from temporary Vercel storage
    if (user.resume) {
      const oldFilename = path.basename(user.resume);
      const oldPath = path.join(
        os.tmpdir(),
        "uploads",
        oldFilename
      );

      fs.unlink(oldPath, () => {});
    }

    user.resume = `/uploads/${req.file.filename}`;

    await user.save();

    res.json({
      message: "Resume uploaded successfully.",
      resume: user.resume,
    });
  } catch (err) {
    next(err);
  }
};


// ============================================================
// DELETE RESUME
// ============================================================

export const deleteResume = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    if (user.resume) {
      const oldFilename = path.basename(user.resume);
      const oldPath = path.join(
        os.tmpdir(),
        "uploads",
        oldFilename
      );

      fs.unlink(oldPath, () => {});
    }

    user.resume = null;

    await user.save();

    res.json({
      message: "Resume deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};


// ============================================================
// FORGOT PASSWORD
// ============================================================

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    // Don't reveal whether email exists
    if (!user) {
      return res.json({
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    }

    if (!isEmailConfigured()) {
      return res.status(500).json({
        message: "Email service is not configured.",
      });
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    await PasswordResetRequest.deleteMany({
      userId: user._id,
      used: false,
    });

    await PasswordResetRequest.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      used: false,
    });

    const frontendUrl =
      process.env.FRONTEND_URL ||
      "http://localhost:5173";

    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await sendMail({
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset</h2>
        <p>Hello ${user.name || "User"},</p>
        <p>We received a request to reset your password.</p>
        <p>
          <a href="${resetUrl}">
            Click here to reset your password
          </a>
        </p>
        <p>This link will expire in 30 minutes.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    });

    res.json({
      message:
        "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (err) {
    next(err);
  }
};


// ============================================================
// RESET PASSWORD
// ============================================================

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        message: "Token and new password are required.",
      });
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      return res.status(400).json({
        message: passwordError,
      });
    }

    const tokenHash = hashToken(token);

    const resetRequest = await PasswordResetRequest.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRequest) {
      return res.status(400).json({
        message: "Invalid or expired password reset token.",
      });
    }

    const user = await User.findById(resetRequest.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    user.password = await bcrypt.hash(password, 10);

    await user.save();

    resetRequest.used = true;

    await resetRequest.save();

    res.json({
      message: "Password reset successfully.",
    });
  } catch (err) {
    next(err);
  }
};


// ============================================================
// CHANGE PASSWORD
// ============================================================

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message:
          "Current password and new password are required.",
      });
    }

    const passwordError = validatePassword(newPassword);

    if (passwordError) {
      return res.status(400).json({
        message: passwordError,
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

    res.json({
      message: "Password changed successfully.",
    });
  } catch (err) {
    next(err);
  }
};