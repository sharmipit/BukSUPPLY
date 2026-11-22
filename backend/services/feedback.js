const crypto = require('crypto');
const { google } = require('googleapis');
const settings = require('./settings');

// Everything comes from System Settings > Google Forms feedback. Until an administrator saves
// those values there, settings.get() falls back to the GFORMS_* values in .env.
const cfg = () => settings.get();

const enabled = () => {
  const s = cfg();
  return Boolean(s.formsEnabled && s.formsFormId);
};

// The verification code is optional: it is checked only when a code question is set
const codeEnabled = () => !!String(cfg().formsQCode || '').trim();

const client = () => {
  const credentials = settings.parseServiceAccount(cfg().formsCredentials);
  if (!credentials) {
    throw new Error('Google Forms credentials are missing or unreadable (System Settings).');
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/forms.responses.readonly',
      // Needed to read the form's questions, so the question IDs in the settings can be checked
      'https://www.googleapis.com/auth/forms.body.readonly',
    ],
  });
  return google.forms({ version: 'v1', auth });
};

const normSlip = (s) => String(s || '').trim().toUpperCase();

// Verification code
// A short code derived from the slip number and a server secret. It is pre-filled in the
// form, so a response whose slip number was edited (or invented) no longer matches its code.
// Changing the secret makes codes of earlier responses stop matching.
const codeSecret = () => cfg().formsCodeSecret || process.env.JWT_SECRET || '';

const codeFor = (slip) =>
  crypto
    .createHmac('sha256', codeSecret())
    .update(normSlip(slip))
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();

// Pre-filled link
const fullName = (u) =>
  [u.firstName, u.lastName].filter((n) => n && n !== '-').join(' ') || u.email || '';

// Supported placeholders inside the pre-filled link:
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

  return String(cfg().formsPrefillUrl || '').replace(
    /(?:\{\{|%7B%7B)(\w+)(?:\}\}|%7D%7D)/gi,
    (_, key) => encodeURIComponent(values[String(key).toUpperCase()] ?? '')
  );
};

exports.enabled = enabled;

// Question IDs
// The responses API names every answer by its "questionId". That is NOT always the same number
// as the item ID, so a wrong ID in the settings means every answer is read as empty and no
// feedback is ever detected. To avoid that, each question value may be ANY of:
//   - the real questionId,
//   - the item ID,
//   - or the exact question title.
// The form is read once (cached) and the value is translated to the real questionId.
const FORM_CACHE_MS = 10 * 60 * 1000;
const FORM_RETRY_MS = 30 * 1000;
let formCache = { until: 0, lookup: null, error: '' };

// Responses are cached so the dashboard and the "status" checks don't hit Google's quota.
let cache = { at: 0, data: null };

// When the form, the key or a question changes in System Settings, forget everything cached
let configSignature = '';
function syncConfig() {
  const s = cfg();
  const next = [
    s.formsFormId,
    s.formsCredentials,
    s.formsQSlip,
    s.formsQCode,
    s.formsQRating,
    s.formsQComment,
  ].join('|');
  if (next !== configSignature) {
    configSignature = next;
    formCache = { until: 0, lookup: null, error: '' };
    cache = { at: 0, data: null };
  }
}

const keyOf = (s) => String(s || '').trim().toLowerCase();

async function loadLookup() {
  if (Date.now() < formCache.until) return formCache;

  try {
    const { data } = await client().forms.get({ formId: cfg().formsFormId });
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

// If the form cannot be read, the value from the settings is used as it is
const resolveQid = (value, lookup) => {
  const v = String(value || '').trim();
  if (!v) return '';
  return (lookup && lookup.get(keyOf(v))) || v;
};

// Reading the responses
const answer = (resp, qid) =>
  (qid && resp.answers?.[qid]?.textAnswers?.answers?.[0]?.value) || '';

async function load(maxAgeMs) {
  syncConfig();
  if (cache.data && Date.now() - cache.at < maxAgeMs) return cache.data;

  const form = await loadLookup();
  const forms = client();
  const s = cfg();
  const responses = [];
  let pageToken;
  do {
    const { data } = await forms.forms.responses.list({
      formId: s.formsFormId,
      pageSize: 500,
      pageToken,
    });
    responses.push(...(data.responses || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  const qids = {
    slip: resolveQid(s.formsQSlip, form.lookup),
    code: resolveQid(s.formsQCode, form.lookup),
    rating: resolveQid(s.formsQRating, form.lookup),
    comment: resolveQid(s.formsQComment, form.lookup),
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

// Check feedback submission timestamp for a requisition slip
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

// Diagnostic health check for Google Forms integration
exports.diagnose = async () => {
  if (!enabled()) {
    return {
      enabled: false,
      hint: 'Feedback is turned off, or the Form ID is empty, in System Settings > Google Forms feedback.',
    };
  }

  // Always look at the current form and responses
  syncConfig();
  formCache.until = 0;
  cache.at = 0;

  const out = { enabled: true, codeCheck: codeEnabled() };
  try {
    const data = await load(0);
    const s = cfg();
    const known = formCache.lookup ? new Set(formCache.lookup.values()) : null;
    const q = (configured, qid) => ({
      configured: configured || '',
      resolvedTo: qid,
      existsInForm: known ? known.has(qid) : 'unknown (form could not be read)',
    });

    out.questions = {
      slip: q(s.formsQSlip, data.qids.slip),
      code: q(s.formsQCode, data.qids.code),
      rating: q(s.formsQRating, data.qids.rating),
      comment: q(s.formsQComment, data.qids.comment),
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
      out.hint = 'Google returned 0 responses. Submit the form once, or check the Form ID.';
    } else if (out.responsesWithSlip === 0) {
      out.hint =
        'Responses exist but none has a slip number. The slip number question in System Settings does not match the form.';
    } else if (out.codeCheck && out.responsesAccepted === 0) {
      out.hint =
        'Slip numbers are read, but no verification code matches. Check the verification code question, that {{CODE}} is in the pre-filled link, and that the verification secret did not change.';
    } else {
      out.hint = 'Everything looks fine.';
    }
  } catch (err) {
    out.ok = false;
    out.error = err.message;
    out.hint =
      'Google refused or could not be reached. Check the service account key, that the Google Forms API is enabled, and that the form is shared with the service account as an Editor.';
  }
  return out;
};