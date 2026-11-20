const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const settings = require('./settings');
const ExportHistory = require('../models/ExportHistory');
const { sendDriveLinkEmail } = require('../utils/sendEmail');

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const DEFAULT_FOLDER = 'BukSUPPLY Exports';

// Cached folder. The key changes when the account or folder name changes in System Settings.
let folder = { key: '', id: null };

const isConfigured = () => {
  const s = settings.get();
  return Boolean(s.driveEnabled && s.driveClientId && s.driveClientSecret && s.driveRefreshToken);
};

async function accessToken() {
  const s = settings.get();
  const client = new OAuth2Client(s.driveClientId, s.driveClientSecret);
  client.setCredentials({ refresh_token: s.driveRefreshToken });
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
  const s = settings.get();
  const folderName = s.driveFolderName || DEFAULT_FOLDER;
  const key = `${s.driveClientId}|${folderName}`;
  if (folder.id && folder.key === key) return folder.id;

  const escaped = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await call(token, `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)`);
  let id;
  if (found.files && found.files[0]) {
    id = found.files[0].id;
  } else {
    const created = await call(token, `${API}/files?fields=id`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' }),
    });
    id = created.id;
  }
  folder = { key, id };
  return id;
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

// Upload export to Google Drive, share with downloader, and send email link
async function deliverToDrive({ buffer, filename, mimeType, user, label, historyId, code }) {
  if (!isConfigured()) {
    console.log('[drive] skipped: Google Drive is off or not set up in System Settings.');
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
      folder.id = null; // the folder was deleted: recreate it and retry once
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
