const { app, BrowserWindow, dialog, Menu } = require('electron');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { autoUpdater } = require('electron-updater');

app.setName('ERP System');

// Two roots:
//   binDir  — read-only install resources (postgres binaries, backend.exe, frontend)
//   dataDir — writable user data (pgdata, logs, uploads)
let binDir;
let dataDir;

const BACKEND_PORT = 3002;
const PG_PORT = 5433;

// Lazy path helpers — only valid after dirs are set in whenReady
const paths = () => {
  const PG_BIN = path.join(binDir, 'postgres', 'bin');
  return {
    PG_DATA:     path.join(dataDir, 'pgdata'),
    pgCtl:       path.join(PG_BIN, 'pg_ctl.exe'),
    psql:        path.join(PG_BIN, 'psql.exe'),
    SCHEMA_FILE:  path.join(binDir, 'database', 'schema.sql'),
    MIGRATE_FILE: path.join(binDir, 'database', 'migrate.sql'),
    BACKEND_EXE: path.join(binDir, 'backend.exe'),
  };
};

let mainWindow = null;
let backendProcess = null;
let isQuitting = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const sock = net.createConnection({ port, host: '127.0.0.1' });
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        if (Date.now() - start > timeout) return reject(new Error(`Port ${port} not ready`));
        setTimeout(check, 500);
      });
    };
    check();
  });
}

function log(msg) {
  const logFile = path.join(dataDir, 'erp.log');
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  console.log(msg);
}

// ── PostgreSQL ────────────────────────────────────────────────────────────────

function initDb() {
  const { PG_DATA } = paths();
  const initdbExe = path.join(binDir, 'postgres', 'bin', 'initdb.exe');
  log('Initializing PostgreSQL data directory...');
  // Stop any running postgres before wiping pgdata (avoids EBUSY)
  const { pgCtl } = paths();
  if (fs.existsSync(PG_DATA)) {
    try { execFileSync(pgCtl, ['stop', '-D', PG_DATA, '-m', 'immediate'], { stdio: 'pipe' }); } catch (_) {}
    // Wait briefly for postgres to release file locks
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
    try {
      fs.rmSync(PG_DATA, { recursive: true, force: true });
    } catch (e) {
      throw new Error(`Could not remove old pgdata (${e.message}). Please restart your PC and try again.`);
    }
    log('Removed partial pgdata, starting fresh.');
  }
  fs.mkdirSync(PG_DATA, { recursive: true });
  try {
    execFileSync(initdbExe, ['-D', PG_DATA, '-U', 'postgres', '-A', 'trust'], { env: { ...process.env, PGPASSWORD: '' }, stdio: 'pipe' });
  } catch (e) {
    throw new Error(`initdb failed: ${e.stderr ? e.stderr.toString() : e.message}`);
  }

  const pgHba = path.join(PG_DATA, 'pg_hba.conf');
  let hba = fs.readFileSync(pgHba, 'utf8');
  hba = hba.replace(/scram-sha-256/g, 'trust');
  fs.writeFileSync(pgHba, hba);

  const pgConf = path.join(PG_DATA, 'postgresql.conf');
  fs.appendFileSync(pgConf, `\nport = ${PG_PORT}\nlisten_addresses = 'localhost'\n`);
  log('PostgreSQL data directory initialized.');
}

function startPostgres() {
  const { PG_DATA, pgCtl } = paths();
  return new Promise((resolve, reject) => {
    // Kill any lingering postgres from a previous crash or fast-close
    try { execFileSync(pgCtl, ['stop', '-D', PG_DATA, '-m', 'immediate'], { stdio: 'pipe' }); } catch (_) {}

    const schemaApplied = fs.existsSync(path.join(PG_DATA, '.schema_applied'));
    if (!fs.existsSync(path.join(PG_DATA, 'PG_VERSION')) || !schemaApplied) {
      // No pgdata OR previous init failed before schema was applied — start fresh
      initDb();
    }

    log('Starting PostgreSQL...');
    const pgLog = path.join(dataDir, 'postgres.log');
    const proc = spawn(pgCtl, ['start', '-D', PG_DATA, '-l', pgLog, '-w'], { stdio: 'pipe' });
    proc.on('close', code => {
      if (code === 0) { log('PostgreSQL started.'); resolve(); return; }
      // code 1 can mean "already running" — verify by checking the port
      const sock = require('net').createConnection({ port: PG_PORT, host: '127.0.0.1' });
      sock.once('connect', () => {
        sock.destroy();
        log('PostgreSQL was already running, continuing.');
        resolve();
      });
      sock.once('error', () => {
        sock.destroy();
        const pgLogContent = fs.existsSync(pgLog)
          ? fs.readFileSync(pgLog, 'utf8').split('\n').slice(-15).join('\n')
          : '(no log file)';
        reject(new Error(`pg_ctl start failed (code ${code}):\n\n${pgLogContent}`));
      });
    });
  });
}

function stopPostgres() {
  const { PG_DATA, pgCtl } = paths();
  try {
    execFileSync(pgCtl, ['stop', '-D', PG_DATA, '-m', 'fast'], { stdio: 'pipe' });
    log('PostgreSQL stopped.');
  } catch (e) {
    log(`pg_ctl stop error: ${e.message}`);
  }
}

function applySchema() {
  const { PG_DATA, psql, SCHEMA_FILE } = paths();
  const markerFile = path.join(PG_DATA, '.schema_applied');
  if (fs.existsSync(markerFile)) return;
  log('Applying database schema...');
  const env = { ...process.env, PGPASSWORD: '' };
  const run = (db, sql) => execFileSync(psql,
    ['-U', 'postgres', '-p', String(PG_PORT), '-d', db, '-c', sql],
    { env, stdio: 'pipe' }
  );
  try {
    // Create role and database (ignore errors if they already exist)
    try { run('postgres', "CREATE ROLE erp_user WITH LOGIN PASSWORD 'erppass123';"); } catch (_) {}
    try { run('postgres', 'CREATE DATABASE erp_db OWNER erp_user;'); } catch (_) {}
    // Apply tables to erp_db
    execFileSync(psql, ['-U', 'postgres', '-p', String(PG_PORT), '-d', 'erp_db', '-f', SCHEMA_FILE], { env, stdio: 'pipe' });
  } catch (e) {
    throw new Error(`Schema apply failed: ${e.stderr ? e.stderr.toString() : e.message}`);
  }
  fs.writeFileSync(markerFile, new Date().toISOString());
  log('Schema applied.');
}

function runMigrations() {
  const { psql, MIGRATE_FILE } = paths();
  if (!fs.existsSync(MIGRATE_FILE)) { log('No migrate.sql found, skipping.'); return; }
  log(`Running migrations from: ${MIGRATE_FILE}`);
  try {
    const result = execFileSync(psql, ['-U', 'postgres', '-p', String(PG_PORT), '-d', 'erp_db', '-f', MIGRATE_FILE],
      { env: { ...process.env, PGPASSWORD: '' }, stdio: 'pipe' });
    log(`Migrations complete: ${result ? result.toString().trim() : 'ok'}`);
  } catch (e) {
    const errText = e.stderr ? e.stderr.toString() : e.message;
    log(`Migration error (non-fatal): ${errText}`);
  }
}

// ── Backend ───────────────────────────────────────────────────────────────────

function startBackend() {
  const { BACKEND_EXE } = paths();
  log('Starting backend...');
  const env = {
    ...process.env,
    PORT: String(BACKEND_PORT),
    DB_HOST: 'localhost',
    DB_PORT: String(PG_PORT),
    DB_NAME: 'erp_db',
    DB_USER: 'erp_user',
    DB_PASS: 'erppass123',
    SESSION_SECRET: 'erp_packaged_secret',
    FRONTEND_URL: `http://localhost:${BACKEND_PORT}`,
    NODE_ENV: 'production',
    UPLOADS_DIR: path.join(dataDir, 'uploads'),
  };
  let restartCount = 0;
  const MAX_RESTARTS = 5;

  function spawnBackend() {
    // Kill any process still holding port 3002 (left over from a previous instance during auto-update)
    try {
      execFileSync('powershell', [
        '-NonInteractive', '-Command',
        `$p=(Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue).OwningProcess; if($p){Stop-Process -Id $p -Force -ErrorAction SilentlyContinue}`
      ], { stdio: 'pipe', timeout: 4000 });
      // Brief pause so the OS fully releases the port before we bind it again
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600);
    } catch (_) {}
    backendProcess = spawn(BACKEND_EXE, [], { env, stdio: 'pipe' });
    backendProcess.stdout.on('data', d => log(`[backend] ${d.toString().trim()}`));
    backendProcess.stderr.on('data', d => log(`[backend:err] ${d.toString().trim()}`));
    backendProcess.on('exit', (code, signal) => {
      if (signal === 'SIGTERM' || signal === 'SIGKILL') return; // intentional stop
      log(`[backend] exited with code ${code} — restarting (${restartCount + 1}/${MAX_RESTARTS})...`);
      if (restartCount < MAX_RESTARTS) {
        restartCount++;
        setTimeout(spawnBackend, 1000);
      } else {
        log('[backend] max restarts reached, giving up');
        if (mainWindow) mainWindow.webContents.loadURL('data:text/html,<h2>Backend crashed. Please restart the app.</h2>');
      }
    });
  }

  spawnBackend();
}

function stopBackend() {
  if (backendProcess) {
    try { backendProcess.kill('SIGKILL'); } catch (_) {}
    backendProcess = null;
    // Give the OS ~800 ms to reclaim port 3002 before anything else starts
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800);
    log('Backend stopped.');
  }
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  // Remove the default File/Edit/View/Window/Help menu bar
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'ERP System',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Auto-update ───────────────────────────────────────────────────────────────

function checkForUpdates() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    log(`Update available: v${info.version}`);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available and will download in the background.\n\nYou will be notified when it is ready to install.`,
      buttons: ['OK'],
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent);
    if (mainWindow) mainWindow.setTitle(`ERP System — Downloading update ${pct}%…`);
    log(`Update download: ${pct}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.setTitle('ERP System');
    log(`Update downloaded: v${info.version}`);
    // Write a flag so the next launch can show "just updated" message
    fs.writeFileSync(path.join(dataDir, '.just_updated'), info.version);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready to Install',
      message: `Version ${info.version} has been downloaded.\n\nClick "Restart Now" to install the update. Your data is safe.`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        // Stop the backend first so it releases port 3002 before the new instance starts
        stopBackend();
        isQuitting = true;
        setTimeout(() => autoUpdater.quitAndInstall(), 1500);
      }
    });
  });

  autoUpdater.on('error', (err) => {
    log(`Auto-update error: ${err.message}`);
  });

  autoUpdater.checkForUpdates().catch(err => log(`Update check failed: ${err.message}`));
}

function checkJustUpdated() {
  const flagFile = path.join(dataDir, '.just_updated');
  if (!fs.existsSync(flagFile)) return;
  const version = fs.readFileSync(flagFile, 'utf8').trim();
  fs.unlinkSync(flagFile);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Installed',
    message: `ERP System has been updated to version ${version}.\n\nEverything is up to date and ready to use.`,
    buttons: ['OK'],
  });
  log(`Showed post-update notice for v${version}`);
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (app.isPackaged) {
    binDir  = process.resourcesPath;                    // C:\Program Files\ERP System\resources
    dataDir = app.getPath('userData');                  // C:\Users\HP\AppData\Roaming\ERP System
  } else {
    binDir  = __dirname;
    dataDir = __dirname;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const isPackaged = app.isPackaged;

  try {
    if (isPackaged) {
      // Packaged: start embedded postgres + backend.exe
      await startPostgres();
      await waitForPort(PG_PORT, 60000);
      applySchema();
      runMigrations();
      startBackend();
      await waitForPort(BACKEND_PORT);
    } else {
      // Dev: assume postgres and backend are already running
      log('Dev mode: skipping postgres/backend startup, expecting port 3002 to be live.');
      await waitForPort(BACKEND_PORT, 5000).catch(() => {
        throw new Error('Backend not running on port 3002. Start it with: node backend/src/index.js');
      });
    }
    createWindow();
    if (isPackaged) {
      checkJustUpdated();
      checkForUpdates();
    }
  } catch (err) {
    log(`Startup error: ${err.message}`);
    dialog.showErrorBox('ERP System — Startup Failed', err.message);
    app.quit();
  }
});

function shutdown() {
  if (isQuitting) return;
  isQuitting = true;
  stopBackend();
  stopPostgres();
}

app.on('window-all-closed', () => {
  shutdown();
  app.quit();
});

app.on('before-quit', () => {
  shutdown();
});
