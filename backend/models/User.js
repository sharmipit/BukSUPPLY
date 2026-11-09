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
      unique: true,
      sparse: true, // accounts without an ID (old test accounts, admins) don't conflict
      // Required for local signups, and for NEW Google accounts (collected during Google sign-up)
      required: [
        function () {
          return this.authProvider === "local" || (this.authProvider === "google" && this.isNew);
        },
        "ID number is required",
      ],
    },
    // Optional PH mobile number, editable from the Profile page (empty string allowed)
    contactNumber: {
      type: String,
      trim: true,
      default: "",
      match: [
        /^((09|\+639)\d{9})?$/,
        "Use a valid PH mobile number, e.g. 09123456789.",
      ],
    },
    // Profile photo URL (e.g. the Google picture saved at Google sign-in)
    avatar: { type: String, trim: true, default: "" },
    password: {
      type: String,
      select: false,
      required: [function () { return this.authProvider === "local"; }, "Password is required"],
    },
    // Identifies which login method created/owns this account
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    // Google's stable per-account ID (the `sub` claim), used to link accounts
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

    // --- Two-step verification (Administrator only) ---
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },        // stored encrypted
    twoFactorBackupCodes: { type: [String], select: false }, // stored hashed

    // --- Email notifications (set to false to opt out) ---
    emailNotifications: { type: Boolean, default: true },
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