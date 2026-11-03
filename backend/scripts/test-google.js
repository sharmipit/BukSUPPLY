require('dotenv').config();
const settings = require('../services/settings');

(async () => {
  const s = settings.get();
  if (!s.googleClientId || !s.googleClientSecret) {
    return console.log('Missing client ID or secret.');
  }

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: 'test',
      client_id: s.googleClientId,
      client_secret: s.googleClientSecret,
      redirect_uri: 'http://localhost',
      grant_type: 'authorization_code',
    }),
  });
  const j = await r.json();

  if (j.error === 'invalid_grant') console.log('OK: ID and secret are valid.');
  else if (j.error === 'invalid_client') console.log('BAD: wrong client ID or secret.', j.error_description);
  else console.log('Unexpected:', j);
})();
