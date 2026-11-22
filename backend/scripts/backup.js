const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Load environment variables from backend/.env if MONGODB_URI is not already set
if (!process.env.MONGODB_URI) {
  const envPaths = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend/.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      if (process.env.MONGODB_URI) break;
    }
  }
}

function maskCredentials(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/:\/\/([^:]+):([^@]+)@/g, '://$1:****@');
}

function pruneLocalBackups(backupsDir, keepCount) {
  try {
    const files = fs
      .readdirSync(backupsDir)
      .filter((file) => file.startsWith('backup-') && file.endsWith('.gz'))
      .map((file) => {
        const filePath = path.join(backupsDir, file);
        const stat = fs.statSync(filePath);
        return { name: file, path: filePath, mtime: stat.mtimeMs };
      });

    // Sort newest first
    files.sort((a, b) => b.mtime - a.mtime);

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      for (const file of toDelete) {
        try {
          fs.unlinkSync(file.path);
          console.log(`Pruned old local backup: ${file.name}`);
        } catch (err) {
          console.warn(`Failed to prune local backup ${file.name}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.warn('Warning: Could not prune old local backups:', err.message);
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not set in environment or backend/.env');
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '../..');
  const backupsDir = path.join(projectRoot, 'backups');

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const archiveName = `backup-${timestamp}.gz`;
  const archivePath = path.join(backupsDir, archiveName);

  console.log(`Starting MongoDB backup to: ${archivePath}`);
  console.log(`Target cluster URI: ${maskCredentials(uri)}`);

  const dumpArgs = [
    `--uri=${uri}`,
    `--archive=${archivePath}`,
    '--gzip',
  ];

  const dumpProcess = spawn('mongodump', dumpArgs, { stdio: ['inherit', 'pipe', 'pipe'] });

  dumpProcess.stdout.on('data', (data) => {
    process.stdout.write(maskCredentials(data.toString()));
  });

  dumpProcess.stderr.on('data', (data) => {
    process.stderr.write(maskCredentials(data.toString()));
  });

  dumpProcess.on('close', async (code) => {
    if (code !== 0) {
      console.error(`mongodump failed with exit code ${code}`);
      if (fs.existsSync(archivePath)) {
        try { fs.unlinkSync(archivePath); } catch (_) {}
      }
      process.exit(1);
    }

    if (!fs.existsSync(archivePath)) {
      console.error('Backup failed: archive file was not created.');
      process.exit(1);
    }

    const minSizeKb = parseInt(process.env.BACKUP_MIN_SIZE_KB, 10) || 5;
    const stats = fs.statSync(archivePath);
    const sizeKb = stats.size / 1024;
    const sizeMb = (sizeKb / 1024).toFixed(2);

    if (sizeKb < minSizeKb) {
      console.error(`Backup archive is too small (${sizeKb.toFixed(2)} KB < ${minSizeKb} KB). Deleting partial archive...`);
      try { fs.unlinkSync(archivePath); } catch (_) {}
      process.exit(1);
    }

    console.log(`Backup completed successfully: ${archiveName} (${sizeMb} MB / ${stats.size} bytes)`);

    const keepCount = parseInt(process.env.BACKUP_KEEP, 10) || 14;
    pruneLocalBackups(backupsDir, keepCount);

    if (process.argv.includes('--upload-drive')) {
      console.log('Initiating Google Drive upload (--upload-drive passed)...');
      try {
        const { uploadBackup } = require('./uploadToDrive');
        await uploadBackup(archivePath);
      } catch (err) {
        console.error('Google Drive upload failed:', err.message);
        process.exit(1);
      }
    }
  });

  dumpProcess.on('error', (err) => {
    console.error('Failed to spawn mongodump:', maskCredentials(err.message));
    if (fs.existsSync(archivePath)) {
      try { fs.unlinkSync(archivePath); } catch (_) {}
    }
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Fatal backup error:', maskCredentials(err.message));
  process.exit(1);
});
