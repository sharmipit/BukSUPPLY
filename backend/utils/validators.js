// Server-side validation rules (matches frontend src/utils/fieldRules.js)

const LIMITS = {
  name: { max: 50, maxWords: 4, minLetters: 2 },
  email: { max: 100 },
  password: { min: 8, max: 64 },
  reason: { min: 5, max: 300 },
  search: { max: 60 },
};

const squash = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const countWords = (v) => squash(v).split(' ').filter(Boolean).length;
const countLetters = (v) => (String(v).match(/\p{L}/gu) || []).length;

// Names
const cleanName = (value) =>
  String(value ?? '')
    .replace(/[^\p{L}\p{M} .'’-]/gu, '')
    .replace(/^[\s.'’-]+/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/([.'’-])\1+/g, '$1')
    .split(' ')
    .slice(0, LIMITS.name.maxWords)
    .join(' ')
    .slice(0, LIMITS.name.max);

// Trimmed, no dangling symbols, every word starts with a capital (juan dela cruz -> Juan Dela Cruz)
const formatName = (value) =>
  cleanName(value)
    .trim()
    .replace(/[\s'’-]+$/, '')
    .replace(/(^|[\s'’-])(\p{Ll})/gu, (_, before, letter) => before + letter.toLocaleUpperCase('en-PH'));

const nameProblem = (value, label = 'Name') => {
  const v = squash(value);
  if (!v) return `${label} is required.`;
  if (/[^\p{L}\p{M} .'’-]/u.test(v))
    return `${label} can only have letters, spaces and . ' - (no numbers or other symbols).`;
  if (/^[.'’-]/.test(v)) return `${label} must start with a letter.`;
  if (/([.'’-])\1/.test(v)) return 'No repeated symbols (.. -- \'\').';
  if (countLetters(v) < LIMITS.name.minLetters)
    return `${label} needs at least ${LIMITS.name.minLetters} letters.`;
  if (countWords(v) > LIMITS.name.maxWords)
    return `${label} can have at most ${LIMITS.name.maxWords} words.`;
  if (v.length > LIMITS.name.max)
    return `${label} can have at most ${LIMITS.name.max} characters.`;
  return '';
};

// Email
const emailShapeProblem = (email) => {
  const v = String(email ?? '').trim().toLowerCase();
  if (!v) return 'Email address is required.';
  if (v.length > LIMITS.email.max) return `Email can have at most ${LIMITS.email.max} characters.`;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+$/.test(v)) return 'Enter a valid email address.';
  return '';
};

// ID number (Student: 10 digits; Staff/Moderator: P- followed by 3-6 digits)
const idProblem = (role, raw) => {
  const id = String(raw ?? '').trim().toUpperCase();
  if (!id) return 'ID number is required.';
  if (role === 'Student')
    return /^\d{10}$/.test(id) ? '' : 'Student ID must be 10 digits, e.g. 2400000000.';
  return /^P-\d{3,6}$/.test(id)
    ? ''
    : 'Employee ID must look like P-0000 (the letter P, a hyphen, then 3-6 digits).';
};

// Password
const passwordProblem = (pw) => {
  const v = String(pw ?? '');
  if (!v) return 'Password is required.';
  if (v.length < LIMITS.password.min)
    return `Password must be at least ${LIMITS.password.min} characters.`;
  if (v.length > LIMITS.password.max)
    return `Password can have at most ${LIMITS.password.max} characters.`;
  if (/\s/.test(v)) return 'Passwords cannot contain spaces.';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v))
    return 'Password must include at least one letter and one number.';
  return '';
};

// Contact number (optional)
const contactProblem = (value) => {
  const v = String(value ?? '').trim();
  if (!v) return '';
  return /^(09|\+639)\d{9}$/.test(v) ? '' : 'Use a valid PH number: 09XXXXXXXXX or +639XXXXXXXXX.';
};

// Reasons, notes, messages
const TEXT_DISALLOWED = /[<>{}`\\\u0000-\u001F\u007F]/;

const reasonProblem = (
  value,
  { required = false, min = LIMITS.reason.min, max = LIMITS.reason.max, label = 'This field' } = {}
) => {
  const v = squash(value);
  if (!v) return required ? `${label} is required.` : '';
  if (required && v.length < min) return `Please enter at least ${min} characters.`;
  if (v.length > max) return `Please keep it to ${max} characters or fewer.`;
  if (TEXT_DISALLOWED.test(v)) return 'These characters are not allowed: < > { } ` \\';
  if (!/[\p{L}\p{N}]/u.test(v)) return 'Please include at least one letter or number.';
  return '';
};

module.exports = {
  LIMITS,
  squash,
  formatName,
  nameProblem,
  emailShapeProblem,
  idProblem,
  passwordProblem,
  contactProblem,
  reasonProblem,
};