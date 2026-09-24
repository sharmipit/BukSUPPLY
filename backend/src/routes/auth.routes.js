const express = require('express');
const limiter = require('../middleware/rateLimiter');
const auth = require('../controllers/auth.controller');

const router = express.Router();

router.get('/options', auth.getOptions);

// Sign up (admins have no public sign up)
router.post('/signup/user', limiter, auth.signUp('user'));
router.post('/signup/staff', limiter, auth.signUp('staff'));

// Sign in
router.post('/signin/user', limiter, auth.signIn(['user']));
router.post('/signin/staff', limiter, auth.signIn(['staff']));
router.post('/signin/admin', limiter, auth.signIn(['admin']));

// Forgot password (all roles): email -> code -> new password
router.post('/forgot-password', limiter, auth.forgotPassword);
router.post('/verify-reset-code', limiter, auth.verifyResetCode);
router.post('/reset-password', limiter, auth.resetPassword);

module.exports = router;