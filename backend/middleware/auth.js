const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Not authorized." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ message: "Not authorized." });

    if (user.accountStatus === "Deactivated") {
      return res
        .status(403)
        .json({ message: "This account has been deactivated." });
    }

    req.user = user; // full document, so controllers don't need to refetch
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token." });
  }
};

// Usage: router.use(protect, restrictTo("Administrator"))
// Must run AFTER protect, since it reads req.user.
exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to do this." });
    }
    next();
  };