const { google } = require('googleapis');

const enabled = () => process.env.GFORMS_ENABLED === 'true' && !!process.env.GFORMS_FORM_ID;

const client = () => {
  const credentials = JSON.parse(
    Buffer.from(process.env.GFORMS_CREDENTIALS_B64 || '', 'base64').toString('utf8')
  );
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/forms.responses.readonly'],
  });
  return google.forms({ version: 'v1', auth });
};

// Prefilled link for one slip
exports.linkFor = (slip) =>
  process.env.GFORMS_PREFILL_URL.replace('{{SLIP}}', encodeURIComponent(slip));

exports.enabled = enabled;

const answer = (resp, qid) => resp.answers?.[qid]?.textAnswers?.answers?.[0]?.value || '';

// Cached for 60s so the dashboard doesn't hit Google's quota
let cache = { at: 0, data: null };

exports.summary = async () => {
  if (cache.data && Date.now() - cache.at < 60000) return cache.data;

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

  const { GFORMS_Q_SLIP, GFORMS_Q_RATING, GFORMS_Q_COMMENT } = process.env;

  const rows = responses
    .map((r) => ({
      slip: answer(r, GFORMS_Q_SLIP),
      rating: Number(answer(r, GFORMS_Q_RATING)) || null,
      comment: answer(r, GFORMS_Q_COMMENT),
      at: r.lastSubmittedTime || r.createTime,
    }))
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  const rated = rows.filter((r) => r.rating);
  const distribution = [1, 2, 3, 4, 5].map((n) => rated.filter((r) => r.rating === n).length);

  const data = {
    count: rows.length,
    average: rated.length
      ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10
      : null,
    distribution, // index 0 = 1 star ... index 4 = 5 stars
    recent: rows.filter((r) => r.comment).slice(0, 8),
    submittedSlips: rows.map((r) => r.slip).filter(Boolean),
  };

  cache = { at: Date.now(), data };
  return data;
};