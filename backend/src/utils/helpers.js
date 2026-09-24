// Only accept real strings, so inputs like {"$gt": ""} can't be used for NoSQL injection
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const clean = (v) => text(v).toLowerCase();

const DUPLICATE_MESSAGES = {
  email: 'This email is already registered.',
  idNumber: 'This ID number is already registered.',
  employeeId: 'This Employee ID is already registered.',
};

// Turns database errors into friendly JSON for the frontend
function sendError(res, err) {
  if (err.name === 'ValidationError') {
    const errors = {};
    for (const [field, e] of Object.entries(err.errors)) {
      errors[field === 'passwordHash' ? 'password' : field] = e.message;
    }
    return res.status(400).json({ success: false, message: 'Please correct the highlighted fields.', errors });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return res.status(409).json({ success: false, message: DUPLICATE_MESSAGES[field] || 'Already registered.' });
  }
  console.error(err);
  return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
}

module.exports = { text, clean, sendError };