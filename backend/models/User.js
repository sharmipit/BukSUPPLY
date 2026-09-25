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
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Student ID Number or Employee/Personnel ID, depending on role
    idNumber: {
      type: String,
      required: [true, "ID number is required"],
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false, // never returned by default; opt in with .select("+password")
    },
    role: {
      type: String,
      enum: ["Student", "Regular Staff", "Moderator", "Administrator"],
      required: [true, "Role is required"],
    },
    accountStatus: {
      type: String,
      enum: ["Active", "Deactivated"],
      default: "Active",
    },
    termsAndConditions: {
      type: Boolean,
      required: [true, "You must accept the Terms and Conditions"],
      validate: {
        validator: (v) => v === true,
        message: "Terms and Conditions must be accepted",
      },
    },
    privacyPolicy: {
      type: Boolean,
      required: [true, "You must accept the Privacy Policy"],
      validate: {
        validator: (v) => v === true,
        message: "Privacy Policy must be accepted",
      },
    },

    // --- Forgot Password (6-digit OTP workflow) ---
    resetPasswordOtp: {
      type: String,
      select: false,
    },
    resetPasswordOtpExpires: {
      type: Date,
      select: false,
    },
    resetPasswordOtpUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// --- Hash password before saving, only if it was modified ---
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// --- Instance method: compare plaintext login password to hashed one ---
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);