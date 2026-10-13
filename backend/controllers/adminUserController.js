const mongoose = require("mongoose");
const User = require("../models/User");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Shape a DB user into what the UserManagement table expects
const toDTO = (u) => ({
  _id: u._id,
  id: u.idNumber || "—",
  name: `${u.firstName} ${u.lastName}`,
  role: u.role === "Regular Staff" ? "Staff" : u.role,
  email: u.email,
  contact: u.contactNumber || "",
  status: u.accountStatus,
});

// GET /api/admin/users?filter=All&search=&page=1&limit=5
exports.getUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 50);
    const filter = req.query.filter || "All";
    const search = (req.query.search || "").trim();

    // Administrators are never listed
    const query = { role: { $in: ["Student", "Regular Staff", "Moderator"] } };

    if (filter === "User") query.role = { $in: ["Student", "Regular Staff"] };
    else if (filter === "Moderator") query.role = "Moderator";
    else if (filter === "Deactivated") query.accountStatus = "Deactivated";

    if (search) {
      const rx = escapeRegex(search);
      query.$or = [
        { idNumber: { $regex: rx, $options: "i" } },
        // matches "Last, First"
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$lastName", ", ", "$firstName"] },
              regex: rx,
              options: "i",
            },
          },
        },
        // matches "First Last"
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstName", " ", "$lastName"] },
              regex: rx,
              options: "i",
            },
          },
        },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.json({ users: users.map(toDTO), total, page, limit });
  } catch (err) {
    console.error("getUsers error:", err);
    res.status(500).json({ message: "Failed to load users." });
  }
};

// POST /api/admin/users/moderators
exports.createModerator = async (req, res) => {
  try {
    const idNumber = (req.body.idNumber || "").trim().toUpperCase();
    const firstName = (req.body.firstName || "").trim();
    const lastName = (req.body.lastName || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!idNumber)
      return res
        .status(400)
        .json({ message: "ID number is required.", field: "idNumber" });
    if (!/^[A-Z0-9-]{3,20}$/.test(idNumber))
      return res
        .status(400)
        .json({
          message: "Use 3-20 letters, numbers, or hyphens.",
          field: "idNumber",
        });
    if (!firstName)
      return res
        .status(400)
        .json({ message: "First name is required.", field: "firstName" });
    if (!lastName)
      return res
        .status(400)
        .json({ message: "Last name is required.", field: "lastName" });
    if (!/^[^@\s]+@buksu\.edu\.ph$/.test(email))
      return res
        .status(400)
        .json({
          message: "Moderators must use an @buksu.edu.ph email.",
          field: "email",
        });
    if (password.length < 8)
      return res
        .status(400)
        .json({
          message: "Password must be at least 8 characters.",
          field: "password",
        });

    const user = await User.create({
      firstName,
      lastName,
      email,
      idNumber,
      password, // hashed by the pre("save") hook
      role: "Moderator",
      authProvider: "local",
      accountStatus: "Active",
      agreedToTerms: true,
    });

    res.status(201).json({ user: toDTO(user) });
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern?.email)
        return res
          .status(409)
          .json({
            message: "An account with this email already exists.",
            field: "email",
          });
      if (err.keyPattern?.idNumber)
        return res
          .status(409)
          .json({
            message: "This ID number is already in use.",
            field: "idNumber",
          });
    }
    if (err.name === "ValidationError") {
      const first = Object.values(err.errors)[0];
      return res
        .status(400)
        .json({ message: first.message, field: first.path });
    }
    console.error("createModerator error:", err);
    res.status(500).json({ message: "Failed to create moderator." });
  }
};

// PATCH /api/admin/users/:id/reactivate
exports.reactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid user ID." });

    const user = await User.findOneAndUpdate(
      { _id: id, accountStatus: "Deactivated" },
      { accountStatus: "Active" },
      { new: true },
    );

    if (!user) {
      const exists = await User.exists({ _id: id });
      return res
        .status(exists ? 400 : 404)
        .json({
          message: exists ? "Account is not deactivated." : "User not found.",
        });
    }
    res.json({ user: toDTO(user) });
  } catch (err) {
    console.error("reactivateUser error:", err);
    res.status(500).json({ message: "Failed to reactivate account." });
  }
};
