const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { autoUpdater } = require('electron-updater');

app.setName('ERP System');

let binDir;
let dataDir;

const BACKEND_PORT = 3002;
const PG_PORT = 5433;

const paths = () => {
  const PG_BIN = path.join(binDir, 'postgres', 'bin');
  return {
    PG_DATA:      path.join(dataDir, 'pgdata'),
    pgCtl:        path.join(PG_BIN, 'pg_ctl.exe'),
    psql:         path.join(PG_BIN, 'psql.exe'),
    SCHEMA_FILE:  path.join(binDir, 'database', 'schema.sql'),
    MIGRATE_FILE: path.join(binDir, 'database', 'migrate.sql'),
    BACKEND_EXE:  path.join(binDir, 'backend.exe'),
  };
};

let mainWindow = null;
let backendProcess = null;
let isQuitting = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const sock = net.createConnection({ port, host: '127.0.0.1' });
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        if (Date.now() - start > timeout) return reject(new Error(`Port ${port} not ready after ${timeout}ms`));
        setTimeout(check, 500);
      });
    };
    check();
  });
}

function waitForPostgres(timeout = 60000) {
  const pgIsReady = path.join(binDir, 'postgres', 'bin', 'pg_isready.exe');
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      try {
        execFileSync(pgIsReady, ['-h', 'localhost', '-p', String(PG_PORT), '-q'], { stdio: 'pipe' });
        resolve();
      } catch (_) {
        if (Date.now() - start > timeout) return reject(new Error('PostgreSQL did not become ready in time'));
        setTimeout(check, 500);
      }
    };
    check();
  });
}

function log(msg) {
  try {
    const logFile = path.join(dataDir, 'erp.log');
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
  console.log(msg);
}

function setSplashMsg(msg) {
  log(msg);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(
      `var e=document.getElementById('msg');if(e)e.textContent=${JSON.stringify(msg)};`
    ).catch(() => {});
  }
}

// ── PostgreSQL ────────────────────────────────────────────────────────────────

function initDb() {
  const { PG_DATA } = paths();
  const initdbExe = path.join(binDir, 'postgres', 'bin', 'initdb.exe');
  const { pgCtl } = paths();
  setSplashMsg('Setting up database for first run...');
  if (fs.existsSync(PG_DATA)) {
    try { execFileSync(pgCtl, ['stop', '-D', PG_DATA, '-m', 'immediate'], { stdio: 'pipe' }); } catch (_) {}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
    try { fs.rmSync(PG_DATA, { recursive: true, force: true }); }
    catch (e) { throw new Error(`Could not remove old pgdata (${e.message}). Please restart your PC and try again.`); }
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
  fs.appendFileSync(path.join(PG_DATA, 'postgresql.conf'), `\nport = ${PG_PORT}\nlisten_addresses = 'localhost'\n`);
  log('PostgreSQL data directory initialized.');
}

function startPostgres() {
  const { PG_DATA, pgCtl } = paths();
  return new Promise((resolve, reject) => {
    try { execFileSync(pgCtl, ['stop', '-D', PG_DATA, '-m', 'immediate'], { stdio: 'pipe' }); } catch (_) {}
    const schemaApplied = fs.existsSync(path.join(PG_DATA, '.schema_applied'));
    if (!fs.existsSync(path.join(PG_DATA, 'PG_VERSION')) || !schemaApplied) {
      initDb();
    }
    setSplashMsg('Starting database...');
    const pgLog = path.join(dataDir, 'postgres.log');
    const proc = spawn(pgCtl, ['start', '-D', PG_DATA, '-l', pgLog, '-w'], { stdio: 'pipe' });
    proc.on('close', code => {
      if (code === 0) { log('PostgreSQL started.'); resolve(); return; }
      const sock = net.createConnection({ port: PG_PORT, host: '127.0.0.1' });
      sock.once('connect', () => { sock.destroy(); log('PostgreSQL already running.'); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        const pgLogContent = fs.existsSync(pgLog)
          ? fs.readFileSync(pgLog, 'utf8').split('\n').slice(-15).join('\n')
          : '(no log)';
        reject(new Error(`pg_ctl start failed (code ${code}):\n\n${pgLogContent}`));
      });
    });
  });
}

function stopPostgres() {
  const { PG_DATA, pgCtl } = paths();
  try { execFileSync(pgCtl, ['stop', '-D', PG_DATA, '-m', 'fast'], { stdio: 'pipe' }); log('PostgreSQL stopped.'); }
  catch (e) { log(`pg_ctl stop error: ${e.message}`); }
}

function applySchema() {
  const { PG_DATA, psql, SCHEMA_FILE } = paths();
  const markerFile = path.join(PG_DATA, '.schema_applied');
  if (fs.existsSync(markerFile)) return;
  setSplashMsg('Applying database schema...');
  const env = { ...process.env, PGPASSWORD: '' };
  const run = (db, sql) => execFileSync(psql, ['-U', 'postgres', '-p', String(PG_PORT), '-d', db, '-c', sql], { env, stdio: 'pipe' });
  try {
    try { run('postgres', "CREATE ROLE erp_user WITH LOGIN PASSWORD 'erppass123';"); } catch (_) {}
    try { run('postgres', 'CREATE DATABASE erp_db OWNER erp_user;'); } catch (_) {}
    execFileSync(psql, ['-U', 'postgres', '-p', String(PG_PORT), '-d', 'erp_db', '-f', SCHEMA_FILE], { env, stdio: 'pipe' });
  } catch (e) {
    throw new Error(`Schema apply failed: ${e.stderr ? e.stderr.toString() : e.message}`);
  }
  fs.writeFileSync(markerFile, new Date().toISOString());
  log('Schema applied.');
}

function runMigrations() {
  const { psql, MIGRATE_FILE } = paths();
  if (!fs.existsSync(MIGRATE_FILE)) { log('No migrate.sql, skipping.'); return; }
  setSplashMsg('Running migrations...');
  try {
    execFileSync(psql, ['-U', 'postgres', '-p', String(PG_PORT), '-d', 'erp_db', '-f', MIGRATE_FILE],
      { env: { ...process.env, PGPASSWORD: '' }, stdio: 'pipe' });
    log('Migrations complete.');
  } catch (e) {
    log(`Migration error (non-fatal): ${e.stderr ? e.stderr.toString() : e.message}`);
  }
}

// ── Backend ───────────────────────────────────────────────────────────────────

function startBackend() {
  const { BACKEND_EXE } = paths();
  setSplashMsg('Starting application server...');
  const env = {
    ...process.env,
    PORT: String(BACKEND_PORT),
    DB_HOST: 'localhost', DB_PORT: String(PG_PORT),
    DB_NAME: 'erp_db', DB_USER: 'erp_user', DB_PASS: 'erppass123',
    SESSION_SECRET: 'erp_packaged_secret',
    FRONTEND_URL: `http://localhost:${BACKEND_PORT}`,
    NODE_ENV: 'production',
    UPLOADS_DIR: path.join(dataDir, 'uploads'),
  };
  let restartCount = 0;
  const MAX_RESTARTS = 5;

  function spawnBackend() {
    try {
      execFileSync('powershell', ['-NonInteractive', '-Command',
        `$p=(Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue).OwningProcess; if($p){Stop-Process -Id $p -Force -ErrorAction SilentlyContinue}`
      ], { stdio: 'pipe', timeout: 4000 });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600);
    } catch (_) {}
    backendProcess = spawn(BACKEND_EXE, [], { env, stdio: 'pipe' });
    backendProcess.stdout.on('data', d => log(`[backend] ${d.toString().trim()}`));
    backendProcess.stderr.on('data', d => log(`[backend:err] ${d.toString().trim()}`));
    backendProcess.on('exit', (code, signal) => {
      if (signal === 'SIGTERM' || signal === 'SIGKILL') return;
      log(`[backend] exited (code ${code}) — restarting (${restartCount + 1}/${MAX_RESTARTS})...`);
      if (restartCount < MAX_RESTARTS) { restartCount++; setTimeout(spawnBackend, 1000); }
      else {
        log('[backend] max restarts reached');
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
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800);
    log('Backend stopped.');
  }
}

// ── Window ────────────────────────────────────────────────────────────────────

ipcMain.on('titlebar-theme', (_, theme) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(theme === 'light' ? '#ffffff' : '#191919');
  }
});

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1440, height: 900,
    minWidth: 1100, minHeight: 700,
    center: true,
    title: 'ERP System',
    autoHideMenuBar: true,
    backgroundColor: '#191919',
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });
  // Show splash immediately while backend URL loads
  mainWindow.loadFile(path.join(__dirname, 'splash.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function loadApp() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  }
}

// ── Auto-update ───────────────────────────────────────────────────────────────

function checkForUpdates() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', info => {
    log(`Update available: v${info.version}`);
    dialog.showMessageBox(mainWindow, {
      type: 'info', title: 'Update Available',
      message: `Version ${info.version} is available and will download in the background.\n\nYou will be notified when it is ready to install.`,
      buttons: ['OK'],
    });
  });
  autoUpdater.on('download-progress', progress => {
    const pct = Math.round(progress.percent);
    if (mainWindow) mainWindow.setTitle(`ERP System — Downloading update ${pct}%...`);
    log(`Update download: ${pct}%`);
  });
  autoUpdater.on('update-downloaded', info => {
    if (mainWindow) mainWindow.setTitle('ERP System');
    log(`Update downloaded: v${info.version}`);
    fs.writeFileSync(path.join(dataDir, '.just_updated'), info.version);
    dialog.showMessageBox(mainWindow, {
      type: 'info', title: 'Update Ready to Install',
      message: `Version ${info.version} has been downloaded.\n\nClick "Restart Now" to install the update. Your data is safe.`,
      buttons: ['Restart Now', 'Later'], defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) { stopBackend(); isQuitting = true; setTimeout(() => autoUpdater.quitAndInstall(), 1500); }
    });
  });
  autoUpdater.on('error', err => log(`Auto-update error: ${err.message}`));
  autoUpdater.checkForUpdates().catch(err => log(`Update check failed: ${err.message}`));
}

function checkJustUpdated() {
  const flagFile = path.join(dataDir, '.just_updated');
  if (!fs.existsSync(flagFile)) return;
  const version = fs.readFileSync(flagFile, 'utf8').trim();
  fs.unlinkSync(flagFile);
  dialog.showMessageBox(mainWindow, {
    type: 'info', title: 'Update Installed',
    message: `ERP System has been updated to version ${version}.\n\nEverything is up to date and ready to use.`,
    buttons: ['OK'],
  });
  log(`Showed post-update notice for v${version}`);
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (app.isPackaged) {
    binDir  = process.resourcesPath;
    dataDir = app.getPath('userData');
  } else {
    binDir  = __dirname;
    dataDir = __dirname;
  }
  fs.mkdirSync(dataDir, { recursive: true });

  // Show splash window immediately — user sees something right away
  createWindow();

  try {
    if (app.isPackaged) {
      await startPostgres();
      await waitForPostgres();
      applySchema();
      runMigrations();
      startBackend();
      setSplashMsg('Almost ready...');
      await waitForPort(BACKEND_PORT);
    } else {
      log('Dev mode: expecting backend on port 3002.');
      await waitForPort(BACKEND_PORT, 5000).catch(() => {
        throw new Error('Backend not running on port 3002. Start it with: node backend/src/index.js');
      });
    }
    loadApp();
    if (app.isPackaged) {
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

app.on('window-all-closed', () => { shutdown(); app.quit(); });
app.on('before-quit', () => { shutdown(); });
