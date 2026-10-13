const publicUser = (u) => ({
  id: u._id,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  idNumber: u.idNumber,
  role: u.role,
  contactNumber: u.contactNumber,
  ...(u.avatar ? { avatar: u.avatar } : {}), // only send avatar when one exists
  accountStatus: u.accountStatus,
});

exports.getProfile = (req, res) => {
  res.json({ user: publicUser(req.user) });
};

exports.updateProfile = async (req, res) => {
  try {
    const user = req.user;
    const { firstName, lastName, contactNumber } = req.body; // whitelist only
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (contactNumber !== undefined) user.contactNumber = contactNumber;

    await user.save();
    res.json({ user: publicUser(user) });
  } catch (err) {
    if (err.name === "ValidationError") {
      const errors = Object.fromEntries(
        Object.entries(err.errors).map(([k, v]) => [k, v.message]),
      );
      return res.status(400).json({ message: "Validation failed.", errors });
    }
    console.error(err);
    res.status(500).json({ message: "Server error." });
  }
};

exports.deactivateAccount = async (req, res) => {
  try {
    const user = req.user;
    if (user.role === "Administrator") {
      return res.status(403).json({
        message: "Administrators cannot deactivate their own account.",
      });
    }
    user.accountStatus = "Deactivated";
    await user.save();
    res.json({ message: "Account deactivated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error." });
  }
};