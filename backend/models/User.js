const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * BukSUPPLY User Schema
 * Covers: institutional sign up (Student / Regular Staff), sign in for all
 * roles (including Moderator / Administrator provisioned outside public
 * signup), and the 6-digit OTP forgot-password workflow.
 */
const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: [true, "First name is required"], trim: true },
    lastName: { type: String, required: [true, "Last name is required"], trim: true },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^@\s]+@(student\.)?buksu\.edu\.ph$/,
        "Email must be a BukSU institutional address (@student.buksu.edu.ph or @buksu.edu.ph).",
      ],
    },
    idNumber: {
      type: String,
      trim: true,
      // Only required for accounts created the old way (local signup).
      // Google sign-ins start without one and fill it in afterward.
      required: [function () { return this.authProvider === "local"; }, "ID number is required"],
    },
    password: {
      type: String,
      select: false,
      required: [function () { return this.authProvider === "local"; }, "Password is required"],
    },
    // NEW: identifies which login method created/owns this account
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    // NEW: Google's stable per-account ID (the `sub` claim), used to link accounts
    googleId: {
      type: String,
      unique: true,
      sparse: true, // allows many docs with no googleId without violating uniqueness
      select: false,
    },
    role: {
      type: String,
      enum: ["Student", "Regular Staff", "Moderator", "Administrator"],
      required: [true, "Role is required"],
    },
    accountStatus: { type: String, enum: ["Active", "Deactivated"], default: "Active" },
    agreedToTerms: {
      type: Boolean,
      required: [true, "You must agree to the Terms and Conditions and Privacy Policy"],
      validate: {
        validator: (v) => v === true,
        message: "You must agree to the Terms and Conditions and Privacy Policy",
      },
    },
    resetPasswordOtp: { type: String, select: false },
    resetPasswordOtpExpires: { type: Date, select: false },
    resetPasswordOtpUsed: { type: Boolean, default: false },
    resetPasswordOtpAttempts: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false; // Google-only accounts have nothing to compare
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);