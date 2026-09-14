// Shared password policy used by signup, reset-password, and change-password.
// Kept intentionally simple/predictable so error messages stay clear.
export const validatePassword = (password) => {
  if (!password || typeof password !== "string") return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (password.length > 128) return "Password is too long.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain both letters and numbers.";
  }
  const common = ["password", "12345678", "qwerty123", "letmein", "password123"];
  if (common.includes(password.toLowerCase())) {
    return "That password is too common. Please choose a stronger one.";
  }
  return "";
};
