const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

function getCredentials() {
  const rawKey = process.env.GDRIVE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    throw new Error('GDRIVE_SERVICE_ACCOUNT_KEY environment variable is missing.');
  }

  try {
    return JSON.parse(rawKey);
  } catch (e1) {
    try {
      const decoded = Buffer.from(rawKey, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (e2) {
      throw new Error('GDRIVE_SERVICE_ACCOUNT_KEY must be valid JSON or base64-encoded JSON.');
    }
  }
}

function getDriveClient() {
  const creds = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

async function listAllRemoteBackups(drive, folderId) {
  const backupFiles = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and name contains 'backup-' and trashed = false`,
      fields: 'nextPageToken, files(id, name, createdTime, size)',
      orderBy: 'createdTime desc',
      pageSize: 100,
      pageToken: pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (res.data.files && res.data.files.length > 0) {
      backupFiles.push(...res.data.files);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return backupFiles;
}

async function pruneRemoteBackups(drive, folderId, keepCount = 14) {
  console.log(`Checking remote backups in folder (retention: newest ${keepCount})...`);
  const files = await listAllRemoteBackups(drive, folderId);

  // Sort descending by createdTime
  files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

  if (files.length > keepCount) {
    const toDelete = files.slice(keepCount);
    console.log(`Found ${files.length} remote backups. Pruning ${toDelete.length} older backups...`);
    for (const f of toDelete) {
      try {
        await drive.files.delete({
          fileId: f.id,
          supportsAllDrives: true,
        });
        console.log(`Deleted remote backup: ${f.name} (id: ${f.id})`);
      } catch (delErr) {
        console.warn(`Failed to delete remote backup ${f.name}:`, delErr.message);
      }
    }
  } else {
    console.log(`Remote backup count (${files.length}) is within retention limit (${keepCount}).`);
  }
}

async function uploadBackup(filePath) {
  const folderId = process.env.GDRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error('GDRIVE_FOLDER_ID environment variable is missing.');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File to upload does not exist: ${filePath}`);
  }

  const fileName = path.basename(filePath);
  const fileSizeMb = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
  console.log(`Uploading ${fileName} (${fileSizeMb} MB) to Google Drive folder: ${folderId}...`);

  const drive = getDriveClient();

  try {
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };
    const media = {
      mimeType: 'application/gzip',
      body: fs.createReadStream(filePath),
    };

    const res = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, size',
      supportsAllDrives: true,
    });

    console.log(`Successfully uploaded backup to Google Drive. File ID: ${res.data.id}`);

    const keepCount = parseInt(process.env.BACKUP_KEEP_REMOTE, 10) || 14;
    await pruneRemoteBackups(drive, folderId, keepCount);

    return res.data;
  } catch (err) {
    const isQuota =
      (err.message && err.message.includes('storageQuotaExceeded')) ||
      (err.errors && err.errors.some((e) => e.reason === 'storageQuotaExceeded'));

    if (isQuota) {
      console.error('\n[Google Drive Error] storageQuotaExceeded: Storage quota exceeded for service account.');
      console.error('Service accounts have no storage quota on personal Google accounts (0 GB free storage).');
      console.error('To resolve this:');
      console.error('  1. Move the backup destination folder to a Google Workspace Shared Drive (where organization quota is used), OR');
      console.error('  2. Configure OAuth2 user authorization so uploads consume the personal user\'s storage quota.\n');
    }
    throw err;
  }
}

module.exports = { uploadBackup };

if (require.main === module) {
  const targetFile = process.argv[2];
  if (!targetFile) {
    console.error('Usage: node uploadToDrive.js <path-to-file.gz>');
    process.exit(1);
  }
  uploadBackup(path.resolve(targetFile))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Upload failed:', err.message);
      process.exit(1);
    });
}
