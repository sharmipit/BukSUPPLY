// Creates (or promotes) an Administrator account.
// Usage, from the backend folder:
//   node scripts/createAdmin.js sharmagnegamboa11@gmail.com "YourStrongPassword" "First" "Last"
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  const [email, password, firstName = 'Admin', lastName = 'User'] = process.argv.slice(2);

  if (!email || !password) {
    console.log('Usage: node scripts/createAdmin.js <email> <password> [firstName] [lastName]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.log('Password must be at least 8 characters.');
    process.exit(1);
  }

  await connectDB();

  const cleanEmail = email.trim().toLowerCase();
  let user = await User.findOne({ email: cleanEmail }).select('+password');

  if (user) {
    user.role = 'Administrator';
    user.accountStatus = 'Active';
    user.password = password; // hashed by the pre-save hook
    if (!user.authProvider) user.authProvider = 'local';
    console.log(`Existing account found. Promoting ${cleanEmail} to Administrator.`);
  } else {
    user = new User({
      firstName,
      lastName,
      email: cleanEmail,
      idNumber: 'ADMIN-001', // stops the app from asking to complete the profile
      password,
      role: 'Administrator',
      authProvider: 'local',
      accountStatus: 'Active',
      agreedToTerms: true,
    });
    console.log(`Creating Administrator account for ${cleanEmail}.`);
  }

  // The model only allows @buksu.edu.ph emails, so skip that check for this one account.
  await user.save({ validateBeforeSave: false });

  console.log('Done. Sign in with email and password (not Google).');
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('Failed:', e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
