const crypto = require('crypto');
const { google } = require('googleapis');

const enabled = () => process.env.GFORMS_ENABLED === 'true' && !!process.env.GFORMS_FORM_ID;

// The verification code is optional: it is checked only when GFORMS_Q_CODE is set
const codeEnabled = () => !!process.env.GFORMS_Q_CODE;

const client = () => {
  const credentials = JSON.parse(
    Buffer.from(process.env.GFORMS_CREDENTIALS_B64 || '', 'base64').toString('utf8')
  );
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/forms.responses.readonly',
      // Needed to read the form's questions, so the question IDs in .env can be checked
      'https://www.googleapis.com/auth/forms.body.readonly',
    ],
  });
  return google.forms({ version: 'v1', auth });
};

const normSlip = (s) => String(s || '').trim().toUpperCase();

// ---------- Verification code ----------
// A short code derived from the slip number and a server secret. It is pre-filled in the
// form, so a response whose slip number was edited (or invented) no longer matches its code.
const codeSecret = () => process.env.GFORMS_CODE_SECRET || process.env.JWT_SECRET || '';

const codeFor = (slip) =>
  crypto
    .createHmac('sha256', codeSecret())
    .update(normSlip(slip))
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();

// ---------- Pre-filled link ----------
const fullName = (u) =>
  [u.firstName, u.lastName].filter((n) => n && n !== '-').join(' ') || u.email || '';

// Supported placeholders inside GFORMS_PREFILL_URL:
// {{SLIP}} {{CODE}} {{NAME}} {{EMAIL}} {{ID}} {{ROLE}} {{DEPT}}
exports.linkFor = (slip, { user = {}, department = '' } = {}) => {
  const values = {
    SLIP: slip,
    CODE: codeFor(slip),
    NAME: fullName(user),
    EMAIL: user.email || '',
    ID: user.idNumber || '',
    ROLE: user.role === 'Student' ? 'Student' : 'Staff / Faculty',
    DEPT: department || '',
  };

  return String(process.env.GFORMS_PREFILL_URL || '').replace(
    /(?:\{\{|%7B%7B)(\w+)(?:\}\}|%7D%7D)/gi,
    (_, key) => encodeURIComponent(values[String(key).toUpperCase()] ?? '')
  );
};

exports.enabled = enabled;

// ---------- Question IDs ----------
// The responses API names every answer by its "questionId". That is NOT always the same number
// as the item ID that Apps Script prints, so a wrong ID in .env means every answer is read as
// empty and no feedback is ever detected. To avoid that, each GFORMS_Q_* value may be ANY of:
//   - the real questionId,
//   - the item ID printed by Apps Script,
//   - or the exact question title.
// The form is read once (cached) and the value is translated to the real questionId.
const FORM_CACHE_MS = 10 * 60 * 1000;
const FORM_RETRY_MS = 30 * 1000;
let formCache = { until: 0, lookup: null, error: '' };

const keyOf = (s) => String(s || '').trim().toLowerCase();

async function loadLookup() {
  if (Date.now() < formCache.until) return formCache;

  try {
    const { data } = await client().forms.get({ formId: process.env.GFORMS_FORM_ID });
    const items = (data.items || []).filter((i) => i.questionItem?.question?.questionId);
    const lookup = new Map();

    // Later passes win, so a real questionId always beats an item ID or a title
    items.forEach((i) => i.title && lookup.set(keyOf(i.title), i.questionItem.question.questionId));
    items.forEach((i) => i.itemId && lookup.set(keyOf(i.itemId), i.questionItem.question.questionId));
    items.forEach((i) =>
      lookup.set(keyOf(i.questionItem.question.questionId), i.questionItem.question.questionId)
    );

    formCache = { until: Date.now() + FORM_CACHE_MS, lookup, error: '' };
  } catch (err) {
    console.error('feedback: could not read the form questions:', err.message);
    formCache = { until: Date.now() + FORM_RETRY_MS, lookup: null, error: err.message };
  }
  return formCache;
}

// If the form cannot be read, the value from .env is used as it is
const resolveQid = (value, lookup) => {
  const v = String(value || '').trim();
  if (!v) return '';
  return (lookup && lookup.get(keyOf(v))) || v;
};

// ---------- Reading the responses ----------
const answer = (resp, qid) =>
  (qid && resp.answers?.[qid]?.textAnswers?.answers?.[0]?.value) || '';

// Responses are cached so the dashboard and the "status" checks don't hit Google's quota.
let cache = { at: 0, data: null };

async function load(maxAgeMs) {
  if (cache.data && Date.now() - cache.at < maxAgeMs) return cache.data;

  const form = await loadLookup();
  const forms = client();
  const responses = [];
  let pageToken;
  do {
    const { data } = await forms.forms.responses.list({
      formId: process.env.GFORMS_FORM_ID,
      pageSize: 500,
      pageToken,
    });
    responses.push(...(data.responses || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  const env = process.env;
  const qids = {
    slip: resolveQid(env.GFORMS_Q_SLIP, form.lookup),
    code: resolveQid(env.GFORMS_Q_CODE, form.lookup),
    rating: resolveQid(env.GFORMS_Q_RATING, form.lookup),
    comment: resolveQid(env.GFORMS_Q_COMMENT, form.lookup),
  };

  const rows = responses.map((r) => ({
    slip: normSlip(answer(r, qids.slip)),
    code: answer(r, qids.code).trim().toUpperCase(),
    rating: Number(answer(r, qids.rating)) || null,
    comment: answer(r, qids.comment),
    at: r.lastSubmittedTime || r.createTime,
  }));

  cache = { at: Date.now(), data: { rows, qids, total: responses.length, formError: form.error } };
  return cache.data;
}

// A response counts only if it names a slip and (when the code question exists) the code matches
const isValid = (r) => !!r.slip && (!codeEnabled() || r.code === codeFor(r.slip));

// One feedback per slip: the earliest valid response wins, later duplicates are ignored
function firstPerSlip(rows) {
  const bySlip = new Map();
  rows
    .filter(isValid)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .forEach((r) => {
      if (!bySlip.has(r.slip)) bySlip.set(r.slip, r);
    });
  return bySlip;
}

/**
 * When did this slip's feedback arrive? Returns a Date, or null when there is none yet.
 * fresh = true uses a short cache (used right after the user comes back from the form).
 * Throws if Google cannot be reached.
 */
exports.submittedAt = async (slip, { fresh = false } = {}) => {
  const { rows } = await load(fresh ? 5000 : 60000);
  const hit = firstPerSlip(rows).get(normSlip(slip));
  return hit ? new Date(hit.at) : null;
};

exports.summary = async () => {
  const { rows: all } = await load(60000);
  const rows = [...firstPerSlip(all).values()].sort((a, b) => new Date(b.at) - new Date(a.at));

  const rated = rows.filter((r) => r.rating);
  const distribution = [1, 2, 3, 4, 5].map((n) => rated.filter((r) => r.rating === n).length);

  return {
    count: rows.length,
    average: rated.length
      ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10
      : null,
    distribution, // index 0 = 1 star ... index 4 = 5 stars
    recent: rows.filter((r) => r.comment).slice(0, 8),
    submittedSlips: rows.map((r) => r.slip).filter(Boolean),
  };
};

/**
 * Administrator-only health check. Shows what the server can and cannot see,
 * without exposing anybody's answers.
 */
exports.diagnose = async () => {
  if (!enabled()) return { enabled: false, hint: 'GFORMS_ENABLED is not "true" or GFORMS_FORM_ID is empty.' };

  // Always look at the current form and responses
  formCache.until = 0;
  cache.at = 0;

  const out = { enabled: true, codeCheck: codeEnabled() };
  try {
    const data = await load(0);
    const known = formCache.lookup ? new Set(formCache.lookup.values()) : null;
    const q = (envName, qid) => ({
      configured: process.env[envName] || '',
      resolvedTo: qid,
      existsInForm: known ? known.has(qid) : 'unknown (form could not be read)',
    });

    out.questions = {
      slip: q('GFORMS_Q_SLIP', data.qids.slip),
      code: q('GFORMS_Q_CODE', data.qids.code),
      rating: q('GFORMS_Q_RATING', data.qids.rating),
      comment: q('GFORMS_Q_COMMENT', data.qids.comment),
    };
    out.formReadError = data.formError || null;
    out.totalResponses = data.total;
    out.responsesWithSlip = data.rows.filter((r) => r.slip).length;
    out.responsesAccepted = data.rows.filter(isValid).length;
    out.slipsWithFeedback = firstPerSlip(data.rows).size;

    if (data.formError) {
      out.hint =
        'The form questions could not be read. Check that the Google Forms API is enabled and that the form is shared with the service account as an Editor.';
    } else if (data.total === 0) {
      out.hint = 'Google returned 0 responses. Submit the form once, or check the GFORMS_FORM_ID.';
    } else if (out.responsesWithSlip === 0) {
      out.hint = 'Responses exist but none has a slip number. GFORMS_Q_SLIP does not match the slip question.';
    } else if (out.codeCheck && out.responsesAccepted === 0) {
      out.hint =
        'Slip numbers are read, but no verification code matches. Check GFORMS_Q_CODE, that {{CODE}} is in GFORMS_PREFILL_URL, and that GFORMS_CODE_SECRET / JWT_SECRET did not change.';
    } else {
      out.hint = 'Everything looks fine.';
    }
  } catch (err) {
    out.ok = false;
    out.error = err.message;
    out.hint =
      'Google refused or could not be reached. Check GFORMS_CREDENTIALS_B64, that the Google Forms API is enabled, and that the form is shared with the service account as an Editor.';
  }
  return out;
};