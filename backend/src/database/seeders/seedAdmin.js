// Run once from the backend folder: npm run seed:admin
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../connection');
const { Account } = require('../models');

(async () => {
  try {
    await connectDB();
    await Account.init(); // make sure the unique indexes exist
    const email = String(process.env.ADMIN_EMAIL || '').toLowerCase();
    if (await Account.findOne({ email })) return console.log('Admin already exists.');

    const admin = new Account({
      role: 'admin',
      status: 'approved',
      firstName: process.env.ADMIN_FIRST_NAME || 'System',
      lastName: process.env.ADMIN_LAST_NAME || 'Administrator',
      email,
      contactNumber: process.env.ADMIN_CONTACT,
    });
    admin.password = process.env.ADMIN_PASSWORD;
    await admin.save();
    console.log('Admin created:', email);
  } catch (err) {
    console.error('Failed:', err.errors ? Object.values(err.errors).map((e) => e.message) : err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();