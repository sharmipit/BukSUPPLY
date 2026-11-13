// One-time: node scripts/get-drive-token.js
// Sign in with the Google account whose Drive will store the exports.
require('dotenv').config();
const http = require('http');
const { OAuth2Client } = require('google-auth-library');

const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;

(async () => {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return console.log(
      'Add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET to backend/.env first.'
    );
  }
  console.log('Using client ID:', clientId);

  const client = new OAuth2Client(clientId, clientSecret, REDIRECT);

  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forces Google to return a refresh token
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });
  console.log('\nOpen this URL in your browser and approve:\n\n' + url + '\n');

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    if (u.pathname !== '/oauth2callback') return res.end();
    try {
      const { tokens } = await client.getToken(u.searchParams.get('code'));
      res.end('Done. You can close this tab and go back to the terminal.');
      if (!tokens.refresh_token) {
        console.log(
          'No refresh token returned. Remove the app at myaccount.google.com/permissions and run again.'
        );
      } else {
        console.log('\nAdd this line to backend/.env, then restart the server:\n');
        console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      }
    } catch (e) {
      res.end('Failed. See the terminal.');
      console.error(e.message);
    }
    server.close();
  });
  server.listen(PORT);
})();
