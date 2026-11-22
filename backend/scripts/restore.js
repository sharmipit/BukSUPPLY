const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');

function maskCredentials(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/:\/\/([^:]+):([^@]+)@/g, '://$1:****@');
}

function showUsage() {
  console.log(`
Usage: node scripts/restore.js <file.gz> [--dry-run] [--confirm] [--drop] [--db <target>]

Options:
  <file.gz>       Path to the MongoDB archive file (e.g. backups/backup-YYYY-MM-DD-HHMM.gz)
  --dry-run       Simulate the restore process without modifying any data
  --confirm       Skip interactive confirmation prompt
  --drop          Drop collections in the target database before restoring
  --db <target>   Restore into a different target database instead of the source database

Examples:
  node scripts/restore.js backups/backup-2026-11-21-2130.gz --dry-run
  node scripts/restore.js backups/backup-2026-11-21-2130.gz --db buksupply_test
  node scripts/restore.js backups/backup-2026-11-21-2130.gz --drop --confirm
`);
}

function extractSourceDb(uri) {
  if (process.env.MONGODB_DB) return process.env.MONGODB_DB;
  if (!uri) return 'buksupply_dev';
  try {
    const match = uri.match(/\/([^/?]+)(?:\?|$)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (_) {}
  return 'buksupply_dev';
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  let fileArg = null;
  const flags = {
    dryRun: false,
    confirm: false,
    drop: false,
    db: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--confirm') {
      flags.confirm = true;
    } else if (arg === '--drop') {
      flags.drop = true;
    } else if (arg === '--db') {
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags.db = args[i + 1];
        i++;
      } else {
        console.error('Error: --db option requires a target database name argument.');
        process.exit(1);
      }
    } else if (!arg.startsWith('--') && !fileArg) {
      fileArg = arg;
    }
  }

  if (!fileArg) {
    console.error('Error: No backup archive file specified.');
    showUsage();
    process.exit(1);
  }

  const archivePath = path.resolve(fileArg);
  if (!fs.existsSync(archivePath)) {
    console.error(`Error: Archive file not found: ${archivePath}`);
    process.exit(1);
  }

  // Refuse --drop without --db unless --confirm is also passed
  if (flags.drop && !flags.db && !flags.confirm) {
    console.error('Refusal: --drop cannot be used on the primary/source database without explicit --confirm.');
    process.exit(1);
  }

  // Load backend/.env if MONGODB_URI is not set
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

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not defined in environment or backend/.env');
    process.exit(1);
  }

  const sourceDb = extractSourceDb(uri);
  const targetDb = flags.db || sourceDb;

  console.log('--- MongoDB Restore Configuration ---');
  console.log(`Archive file: ${archivePath}`);
  console.log(`Target URI:   ${maskCredentials(uri)}`);
  console.log(`Source DB:    ${sourceDb}`);
  console.log(`Target DB:    ${targetDb}`);
  console.log(`Dry Run:      ${flags.dryRun ? 'YES' : 'NO'}`);
  console.log(`Drop tables:  ${flags.drop ? 'YES' : 'NO'}`);
  console.log('-------------------------------------');

  if (!flags.dryRun && !flags.confirm) {
    const answer = await promptUser(`WARNING: This will overwrite data in "${targetDb}". Type "yes" to proceed: `);
    if (answer.toLowerCase() !== 'yes') {
      console.log('Restore aborted by user.');
      process.exit(0);
    }
  }

  const restoreArgs = [
    `--uri=${uri}`,
    `--archive=${archivePath}`,
    '--gzip',
  ];

  if (flags.dryRun) {
    restoreArgs.push('--dryRun');
  }

  if (flags.drop) {
    restoreArgs.push('--drop');
  }

  if (flags.db) {
    restoreArgs.push(`--nsInclude=${sourceDb}.*`);
    restoreArgs.push(`--nsFrom=${sourceDb}.*`);
    restoreArgs.push(`--nsTo=${targetDb}.*`);
  }

  console.log('Executing mongorestore...');
  const restoreProcess = spawn('mongorestore', restoreArgs, { stdio: ['inherit', 'pipe', 'pipe'] });

  restoreProcess.stdout.on('data', (data) => {
    process.stdout.write(maskCredentials(data.toString()));
  });

  restoreProcess.stderr.on('data', (data) => {
    process.stderr.write(maskCredentials(data.toString()));
  });

  restoreProcess.on('close', (code) => {
    if (code === 0) {
      console.log(`\nRestore operation completed successfully (code: ${code}).`);
      process.exit(0);
    } else {
      console.error(`\nmongorestore exited with error code: ${code}`);
      process.exit(code);
    }
  });

  restoreProcess.on('error', (err) => {
    console.error('Failed to run mongorestore:', maskCredentials(err.message));
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Restore error:', maskCredentials(err.message));
  process.exit(1);
});
