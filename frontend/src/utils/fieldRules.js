// Shared input validation rules for Profile, Sign Up and User Management
// Kept in sync with backend/utils/validators.js

export const LIMITS = {
  name: { max: 50, maxWords: 4, minLetters: 2 },
  email: { max: 100 },
  password: { min: 8, max: 64 },
  studentId: 10, // 2400000000
  staffId: { minDigits: 3, maxDigits: 6 }, // P-000 ... P-000000
  contact: { local: 11, intl: 13 }, // 09XXXXXXXXX / +639XXXXXXXXX
  reason: { min: 5, max: 300 }, // deactivate / reactivate reason, decline note
  requestMessage: { min: 10, max: 500 }, // reactivation request sent by a user
  search: { max: 60 },
};

export const ID_KIND = { student: 'Student', staff: 'Regular Staff' };

const squash = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const countWords = (v) => squash(v).split(' ').filter(Boolean).length;
const countLetters = (v) => (String(v).match(/\p{L}/gu) || []).length;

// Names
// Letters, spaces, and standard name symbols
const NAME_DISALLOWED = /[^\p{L}\p{M} .'’-]/gu;

export function typeName(raw, label = 'Name') {
  const input = String(raw ?? '');
  let notice = '';

  let v = input.replace(NAME_DISALLOWED, '');
  if (v !== input) {
    notice = `${label} can only have letters, spaces and . ' - (no numbers or other symbols).`;
  }

  const noLead = v.replace(/^[\s.'’-]+/, '');
  if (noLead !== v && !notice) notice = `${label} must start with a letter.`;
  v = noLead;

  const tidy = v.replace(/\s{2,}/g, ' ').replace(/([.'’-])\1+/g, '$1');
  if (tidy !== v && !notice) notice = 'No double spaces or repeated symbols (.. -- \'\').';
  v = tidy;

  const words = v.split(' ');
  if (words.length > LIMITS.name.maxWords) {
    v = words.slice(0, LIMITS.name.maxWords).join(' ');
    if (!notice) notice = `${label} can have at most ${LIMITS.name.maxWords} words.`;
  }

  if (v.length > LIMITS.name.max) {
    v = v.slice(0, LIMITS.name.max);
    if (!notice) notice = `${label} can have at most ${LIMITS.name.max} characters.`;
  }
  return { value: v, notice };
}

// Capitalize each word and trim trailing symbols
export const formatName = (value) =>
  typeName(value)
    .value.trim()
    .replace(/[\s'’-]+$/, '')
    .replace(/(^|[\s'’-])(\p{Ll})/gu, (_, before, letter) => before + letter.toLocaleUpperCase('en-PH'));

export function nameProblem(value, label = 'Name') {
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
}

// Email
export function typeEmail(raw, opts = {}) {
  const { domains = [], allowEmails = [], domainMessage = 'Use your BukSU email address.' } = opts;
  const input = String(raw ?? '');
  let notice = '';

  let v = input.replace(/\s/g, '');
  if (v !== input) notice = 'Spaces are not allowed in an email address.';

  const stripped = v.replace(/[^A-Za-z0-9._%+@-]/g, '');
  if (stripped !== v && !notice) {
    notice = 'Email can only have letters, numbers and . _ % + - symbols.';
  }
  v = stripped;

  const firstAt = v.indexOf('@');
  if (firstAt !== -1) {
    const secondAt = v.indexOf('@', firstAt + 1);
    if (secondAt !== -1) {
      v = v.slice(0, secondAt);
      if (!notice) notice = 'An email address can only have one @.';
    }
  }

  if (v.length > LIMITS.email.max) {
    v = v.slice(0, LIMITS.email.max);
    if (!notice) notice = `Email can have at most ${LIMITS.email.max} characters.`;
  }

  // The domain being typed must still be able to become an allowed one
  const at = v.indexOf('@');
  if (!notice && at !== -1 && domains.length) {
    const lower = v.toLowerCase();
    const domain = lower.slice(at + 1);
    const couldMatch =
      !domain ||
      domains.some((d) => d.startsWith(domain)) ||
      allowEmails.some((e) => e.startsWith(lower));
    if (!couldMatch) notice = domainMessage;
  }
  return { value: v, notice };
}

export function emailProblem(value, opts = {}) {
  const { domains, allowEmails = [], domainMessage = 'Use your BukSU email address.' } = opts;
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return 'Email address is required.';
  if (v.length > LIMITS.email.max) return `Email can have at most ${LIMITS.email.max} characters.`;
  if (allowEmails.includes(v)) return '';
  const m = v.match(/^([a-z0-9._%+-]+)@([a-z0-9.-]+)$/);
  if (!m) return 'Enter a valid email address, e.g. name@buksu.edu.ph.';
  if (domains && !domains.includes(m[2])) return domainMessage;
  return '';
}

// ID number
// Student: 10 digits. Employee/Moderator: P- followed by 3-6 digits
const STUDENT_ID = /^\d{10}$/;
const STAFF_ID = /^P-\d{3,6}$/;
const STUDENT_PREFIX = /^\d{0,10}$/;
const STAFF_PREFIX = /^(P(-\d{0,6})?)?$/;

const idFormatMessage = (kind) =>
  kind === ID_KIND.student
    ? 'Student ID must be 10 digits, e.g. 2400000000.'
    : kind === ID_KIND.staff
      ? 'Employee ID must look like P-0000 (the letter P, a hyphen, then 3-6 digits).'
      : 'Enter a Student ID (10 digits) or an Employee ID (e.g. P-0000).';

export function typeId(raw, kind = null) {
  const input = String(raw ?? '');
  let notice = '';

  const stripped = input.replace(/[^A-Za-z0-9-]/g, '');
  if (stripped !== input) notice = idFormatMessage(kind);

  let v = stripped.toUpperCase();
  const cap = kind === ID_KIND.staff ? 8 : LIMITS.studentId;
  if (v.length > cap) {
    v = v.slice(0, cap);
    if (!notice) notice = idFormatMessage(kind);
  }

  if (!notice && v) {
    const ok =
      kind === ID_KIND.student
        ? STUDENT_PREFIX.test(v)
        : kind === ID_KIND.staff
          ? STAFF_PREFIX.test(v)
          : STUDENT_PREFIX.test(v) || STAFF_PREFIX.test(v);
    if (!ok) notice = idFormatMessage(kind);
  }
  return { value: v, notice };
}

export function idProblem(kind, raw) {
  const id = String(raw ?? '').trim().toUpperCase();
  if (!id) return 'ID number is required.';
  const ok =
    kind === ID_KIND.student
      ? STUDENT_ID.test(id)
      : kind === ID_KIND.staff
        ? STAFF_ID.test(id)
        : STUDENT_ID.test(id) || STAFF_ID.test(id);
  return ok ? '' : idFormatMessage(kind);
}

// Password
export function typePassword(raw) {
  const input = String(raw ?? '');
  let notice = '';
  let v = input.replace(/\s/g, '');
  if (v !== input) notice = 'Passwords cannot contain spaces.';
  if (v.length > LIMITS.password.max) {
    v = v.slice(0, LIMITS.password.max);
    if (!notice) notice = `Password can have at most ${LIMITS.password.max} characters.`;
  }
  return { value: v, notice };
}

export function passwordProblem(pw) {
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
}

export function confirmProblem(password, confirm) {
  if (!confirm) return 'Please confirm your password.';
  if (confirm !== password) return 'Passwords do not match.';
  return '';
}

// Contact number: 09XXXXXXXXX or +639XXXXXXXXX
export function typeContact(raw) {
  const input = String(raw ?? '');
  let notice = '';

  const kept = input.replace(/[^\d+]/g, '');
  if (kept !== input) notice = 'Contact number can only have digits (and a + at the start).';

  const intl = kept.startsWith('+');
  const digits = kept.replace(/\+/g, '');
  if (!notice && kept.lastIndexOf('+') > 0) notice = 'The + sign can only be at the very start.';

  const cap = intl ? LIMITS.contact.intl - 1 : LIMITS.contact.local;
  let d = digits;
  if (d.length > cap) {
    d = d.slice(0, cap);
    if (!notice) {
      notice = intl
        ? 'A +639 number has 13 characters: +639XXXXXXXXX.'
        : 'A 09 number has 11 digits: 09XXXXXXXXX.';
    }
  }

  if (!notice && d) {
    const start = intl ? '639' : '09';
    if (!start.startsWith(d.slice(0, start.length))) {
      notice = 'PH mobile numbers start with 09 or +639.';
    }
  }
  return { value: (intl ? '+' : '') + d, notice };
}

// Optional field: empty is fine
export function contactProblem(value) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  return /^(09|\+639)\d{9}$/.test(v) ? '' : 'Use a valid PH number: 09XXXXXXXXX or +639XXXXXXXXX.';
}

// Reason, notes, and messages
const TEXT_DISALLOWED = /[<>{}`\\\u0000-\u001F\u007F]/g;

export function typeReason(raw, max = LIMITS.reason.max) {
  const input = String(raw ?? '').replace(/\s+/g, ' ');
  let notice = '';

  let v = input.replace(TEXT_DISALLOWED, '');
  if (v !== input) notice = 'These characters are not allowed: < > { } ` \\';

  v = v.replace(/^\s+/, '');
  if (v.length > max) {
    v = v.slice(0, max);
    if (!notice) notice = `Please keep it to ${max} characters or fewer.`;
  }
  return { value: v, notice };
}

export function reasonProblem(
  value,
  { required = false, min = LIMITS.reason.min, max = LIMITS.reason.max, label = 'This field' } = {}
) {
  const v = squash(value);
  if (!v) return required ? `${label} is required.` : '';
  if (required && v.length < min) return `Please enter at least ${min} characters.`;
  if (v.length > max) return `Please keep it to ${max} characters or fewer.`;
  if (/[<>{}`\\\u0000-\u001F\u007F]/.test(v)) return 'These characters are not allowed: < > { } ` \\';
  if (!/[\p{L}\p{N}]/u.test(v)) return 'Please include at least one letter or number.';
  return '';
}

// Search input
export const typeSearch = (raw) =>
  String(raw ?? '')
    .replace(/[^\p{L}\p{M}\p{N} .,'’-]/gu, '')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, LIMITS.search.max);