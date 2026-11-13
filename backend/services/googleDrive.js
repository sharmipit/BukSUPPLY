const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const settings = require('./settings');
const ExportHistory = require('../models/ExportHistory');
const { sendDriveLinkEmail } = require('../utils/sendEmail');

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_NAME = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'BukSUPPLY Exports';

let folderId = null; // cached after the first lookup

const isConfigured = () =>
  Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  );

async function accessToken() {
  const client = new OAuth2Client(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Could not get a Google Drive access token.');
  return token;
}

async function call(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Drive API ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

const json = { 'Content-Type': 'application/json' };

// drive.file only sees files this app created, so the app makes (and finds) its own folder.
async function ensureFolder(token) {
  if (folderId) return folderId;
  const name = FOLDER_NAME.replace(/'/g, "\\'");
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await call(token, `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)`);
  if (found.files && found.files[0]) {
    folderId = found.files[0].id;
  } else {
    const created = await call(token, `${API}/files?fields=id`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    folderId = created.id;
  }
  return folderId;
}

async function uploadFile(token, { name, mimeType, buffer }) {
  const parent = await ensureFolder(token);
  const b = `buksupply${crypto.randomBytes(8).toString('hex')}`;
  const meta = JSON.stringify({ name, parents: [parent] });
  const body = Buffer.concat([
    Buffer.from(
      `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
        `--${b}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${b}--`),
  ]);
  return call(token, `${UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body,
  });
}

// Reader access for this one email only. No "anyone with the link".
async function shareWithUser(token, fileId, email) {
  const send = (notify) =>
    call(token, `${API}/files/${fileId}/permissions?sendNotificationEmail=${notify}`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: email }),
    });
  try {
    await send(false); // we send our own email
  } catch (e) {
    // Non-Google accounts require Drive's own invite email
    if (/notif/i.test(e.message)) await send(true);
    else throw e;
  }
}

/**
 * Uploads the file, shares it with the downloader, emails the link and saves it in the
 * history record. Never throws: a Drive or email problem must not affect the download.
 */
async function deliverToDrive({ buffer, filename, mimeType, user, label, historyId, code }) {
  if (!isConfigured()) {
    console.log('[drive] skipped: GOOGLE_DRIVE_REFRESH_TOKEN is not set.');
    return;
  }
  if (!user || !user.email) return;

  try {
    let token = await accessToken();
    const name = filename.replace(/(\.[^.]+)$/, ` (${code})$1`);

    let file;
    try {
      file = await uploadFile(token, { name, mimeType, buffer });
    } catch (e) {
      if (e.status !== 404) throw e;
      folderId = null; // the folder was deleted: recreate it and retry once
      file = await uploadFile(token, { name, mimeType, buffer });
    }

    await shareWithUser(token, file.id, user.email);

    await ExportHistory.findByIdAndUpdate(historyId, {
      driveFileId: file.id,
      driveLink: file.webViewLink,
      driveStatus: 'uploaded',
    });

    await sendDriveLinkEmail(user.email, {
      name: user.firstName,
      label,
      filename: name,
      link: file.webViewLink,
      code,
    });
    console.log(`[drive] ${name} uploaded and shared with ${user.email}`);
  } catch (err) {
    console.error('[drive] delivery failed:', err.message);
    await ExportHistory.findByIdAndUpdate(historyId, { driveStatus: 'failed' }).catch(() => {});
  }
}

module.exports = { deliverToDrive, isConfigured };
