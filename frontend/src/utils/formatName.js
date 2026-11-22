// Shows the first word and the last word of a full name.
// Emails and short names (1-2 words) are returned unchanged.

// Matches standard name suffixes like Jr., Sr., and Roman numerals.
const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;

export function shortName(full) {
  const text = String(full || '').trim();
  if (!text) return '—';
  if (text.includes('@')) return text;

  const parts = text.split(/\s+/);
  if (parts.length <= 2) return text;

  let lastIdx = parts.length - 1;
  if (SUFFIX.test(parts[lastIdx]) && lastIdx > 1) lastIdx -= 1;
  return `${parts[0]} ${parts[lastIdx]}`;
}

export default shortName;