// Gives a weak / medium / strong rating plus one short hint. The format rules

const COMMON = /(password|passw0rd|qwerty|asdf|letmein|welcome|iloveyou|admin|buksu|123456|abc123)/i;
const SEQUENCE = /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|wert|asdf|sdfg)/i;
const REPEAT = /(.)\1{2,}/;

export function getPasswordStrength(password) {
  const pw = String(password ?? '');
  if (!pw) return null;

  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(pw);
  const meetsBasics = pw.length >= 8 && /[A-Za-z]/.test(pw) && hasDigit;

  const common = COMMON.test(pw);
  const repeated = REPEAT.test(pw);
  const sequential = SEQUENCE.test(pw);

  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (hasLower && hasUpper) score += 1;
  if (hasDigit) score += 1;
  if (hasSymbol) score += 1;
  if (repeated) score -= 1;
  if (sequential) score -= 1;
  score = Math.max(0, Math.min(5, score));

  let level = 'weak';
  if (meetsBasics && !common) {
    if (score >= 4) level = 'strong';
    else if (score === 3) level = 'medium';
  }

  // The most useful improvement first
  let hint = '';
  if (pw.length < 8) hint = 'Use at least 8 characters.';
  else if (!hasDigit) hint = 'Add a number.';
  else if (!/[A-Za-z]/.test(pw)) hint = 'Add a letter.';
  else if (common) hint = 'Avoid common words like "password" or "buksu".';
  else if (repeated) hint = 'Avoid repeating the same character.';
  else if (sequential) hint = 'Avoid sequences like "1234" or "abcd".';
  else if (level !== 'strong') {
    if (!(hasLower && hasUpper)) hint = 'Mix uppercase and lowercase letters.';
    else if (pw.length < 12) hint = 'Use 12 or more characters.';
    else if (!hasSymbol) hint = 'Add a symbol such as ! or #.';
  }
  if (level === 'strong') hint = 'Hard to guess.';

  return {
    level,
    label: level === 'strong' ? 'Strong' : level === 'medium' ? 'Medium' : 'Weak',
    hint,
    score,
  };
}