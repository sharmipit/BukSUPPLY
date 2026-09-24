const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const C = require('../constants');

// "required" rules that depend on the role
const isUser = function () { return this.role === 'user'; };
const isStaff = function () { return this.role === 'staff'; };
const isPublic = function () { return this.role !== 'admin'; }; // user + staff
const blankToUndefined = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const mustBeTrue = (msg) => ({ validator: (v) => v === true, message: msg });

const accountSchema = new mongoose.Schema(
  {
    role: { type: String, enum: C.ROLES, required: true },
    status: { type: String, enum: C.STATUSES, default: 'pending' },

    firstName: { type: String, required: [true, 'First name is required.'], trim: true, maxlength: 60 },
    lastName: { type: String, required: [true, 'Last name is required.'], trim: true, maxlength: 60 },
    email: {
      type: String, required: [true, 'Institutional email is required.'],
      unique: true, lowercase: true, trim: true, maxlength: 120,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.'],
    },
    contactNumber: {
      type: String, required: [true, 'Contact number is required.'], trim: true,
      match: [C.PHONE_RE, 'Enter a valid mobile number (e.g. 09123456789).'],
    },
    passwordHash: { type: String, required: [true, 'Password is required.'], select: false },

    // Regular users only
    userType: { type: String, enum: { values: C.USER_TYPES, message: 'Select a valid user type.' }, required: [isUser, 'User type is required.'] },
    idNumber: { type: String, trim: true, maxlength: 30, required: [isUser, 'ID number is required.'], unique: true, sparse: true },
    organizationName: { type: String, trim: true, maxlength: 120, set: blankToUndefined }, // students only
    organizationPosition: { type: String, set: blankToUndefined, enum: { values: C.ORG_POSITIONS, message: 'Select a valid organization position.' } },

    // Staff only
    employeeId: { type: String, trim: true, maxlength: 30, required: [isStaff, 'Employee / Personnel ID is required.'], unique: true, sparse: true },
    position: { type: String, trim: true, maxlength: 100, required: [isStaff, 'Position / Designation is required.'] },

    // Users + staff
    affiliationType: { type: String, enum: ['college', 'office'], required: [isPublic, 'Select college or office.'] },
    affiliation: { type: String, trim: true, required: [isPublic, 'College / Office is required.'] },
    acceptedTerms: { type: Boolean, required: [isPublic, 'You must accept the Terms & Conditions.'], validate: mustBeTrue('You must accept the Terms & Conditions.') },
    acceptedPrivacy: { type: Boolean, required: [isPublic, 'You must accept the Privacy Policy.'], validate: mustBeTrue('You must accept the Privacy Policy.') },
  },
  {
    timestamps: true,
    toJSON: { transform: (_d, ret) => { delete ret.passwordHash; delete ret.__v; return ret; } },
  }
);

// account.password = 'plain text'  ->  hashed automatically when validating/saving
accountSchema.virtual('password').set(function (v) { this._plain = v; });

accountSchema.pre('validate', async function () {
  // 1) password
  if (this._plain !== undefined) {
    const plain = this._plain;
    this._plain = undefined;
    if (typeof plain !== 'string' || !C.PASSWORD_RE.test(plain)) this.invalidate('password', C.PASSWORD_MSG);
    else this.passwordHash = await bcrypt.hash(plain, 12);
  }

  // 2) student/faculty -> college list, non-teaching -> office list; org fields are student-only
  if (this.role === 'user' && this.userType) {
    this.affiliationType = this.userType === 'non_teaching' ? 'office' : 'college';
    if (this.userType !== 'student') { this.organizationName = undefined; this.organizationPosition = undefined; }
  }
  if (this.affiliationType && this.affiliation) {
    const list = this.affiliationType === 'college' ? C.COLLEGES : C.OFFICES;
    if (!list.includes(this.affiliation)) this.invalidate('affiliation', `Select a valid ${this.affiliationType}.`);
  }

  // 3) email domain
  if (this.email && (this.role !== 'user' || this.userType)) {
    const domain = this.role === 'user' && this.userType === 'student' ? C.DOMAIN.student : C.DOMAIN.institutional;
    if (!this.email.endsWith(domain)) this.invalidate('email', `Email must end with ${domain}`);
  }
});

// load the account with .select('+passwordHash') before using this
accountSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(String(plain ?? ''), this.passwordHash);
};

module.exports = mongoose.model('Account', accountSchema);