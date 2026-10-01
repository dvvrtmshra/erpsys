const { app, BrowserWindow, dialog } = require('electron');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

// appDir resolved after app is ready (app.isPackaged only valid then)
let appDir;

const BACKEND_PORT = 3002;
const PG_PORT = 5433;

// Lazy path helpers — only valid after appDir is set in whenReady
const paths = () => {
  const PG_BIN = path.join(appDir, 'postgres', 'bin');
  return {
    PG_DATA:     path.join(appDir, 'pgdata'),
    pgCtl:       path.join(PG_BIN, 'pg_ctl.exe'),
    psql:        path.join(PG_BIN, 'psql.exe'),
    SCHEMA_FILE: path.join(appDir, 'database', 'schema.sql'),
    BACKEND_EXE: path.join(appDir, 'dist', 'backend.exe'),
  };
};

let mainWindow = null;
let backendProcess = null;

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
  const logFile = path.join(appDir, 'erp.log');
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  console.log(msg);
}

// ── PostgreSQL ────────────────────────────────────────────────────────────────

function initDb() {
  const { PG_DATA, pgCtl } = paths();
  log('Initializing PostgreSQL data directory...');
  fs.mkdirSync(PG_DATA, { recursive: true });
  execFileSync(pgCtl, ['initdb', '-D', PG_DATA], { env: { ...process.env, PGPASSWORD: '' }, stdio: 'pipe' });

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
    if (!fs.existsSync(path.join(PG_DATA, 'PG_VERSION'))) initDb();

    log('Starting PostgreSQL...');
    const pgLog = path.join(appDir, 'postgres.log');
    const proc = spawn(pgCtl, ['start', '-D', PG_DATA, '-l', pgLog, '-w'], { stdio: 'pipe' });
    proc.on('close', code => {
      if (code === 0) { log('PostgreSQL started.'); resolve(); }
      else reject(new Error(`pg_ctl start failed with code ${code}`));
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
  execFileSync(psql, ['-U', 'postgres', '-p', String(PG_PORT), '-d', 'postgres', '-f', SCHEMA_FILE], {
    env: { ...process.env, PGPASSWORD: '' }, stdio: 'pipe',
  });
  fs.writeFileSync(markerFile, new Date().toISOString());
  log('Schema applied.');
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
  };
  let restartCount = 0;
  const MAX_RESTARTS = 5;

  function spawnBackend() {
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
    backendProcess.kill();
    backendProcess = null;
    log('Backend stopped.');
  }
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'ERP System',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Resolve appDir now that app is ready
  appDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
  const isPackaged = app.isPackaged;

  try {
    if (isPackaged) {
      // Packaged: start embedded postgres + backend.exe
      await startPostgres();
      await waitForPort(PG_PORT);
      applySchema();
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
  } catch (err) {
    log(`Startup error: ${err.message}`);
    dialog.showErrorBox('ERP System — Startup Failed', err.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  stopPostgres();
  app.quit();
});

app.on('before-quit', () => {
  stopBackend();
  stopPostgres();
});
