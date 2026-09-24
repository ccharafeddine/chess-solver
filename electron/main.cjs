const { app, BrowserWindow, dialog, screen, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const DIST_PATH = path.join(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// A fixed port keeps the app's origin stable between launches. localStorage
// (theme, line count, think time) and the HTTP cache are keyed by origin, so a
// random port silently reset settings every launch and forced a full
// recompile of the 100MB+ engine. Falls back to any free port if the
// preferred one can't be used — taken (EADDRINUSE) or, on Windows, inside a
// range reserved by Hyper-V/WSL/Docker (EACCES).
const PREFERRED_PORT = 47813;

// If the server never comes up we must not sit there windowless holding the
// single-instance lock, so startup is bounded.
const SERVER_START_TIMEOUT_MS = 20000;

// A launch that loses the lock probes the running instance before giving up.
// The primary may still be starting, so allow a few attempts.
const PROBE_ATTEMPTS = 6;
const PROBE_TIMEOUT_MS = 1000;
const PROBE_INTERVAL_MS = 500;

// The layout is a fixed 1100px column (.app max-width) plus its 16px gutters,
// so anything narrower squeezes the board and anything shorter than the
// content leaves a scrollbar down the side for the whole session. These are
// only the fallback: the window measures its own content before it is shown.
const CONTENT_WIDTH = 1100;
const FALLBACK_CONTENT_HEIGHT = 900;
const CONTENT_BOTTOM_GUTTER = 24;
const MIN_CONTENT_WIDTH = 640;
const MIN_CONTENT_HEIGHT = 480;

// The window starts hidden so it can be sized before it appears. This bounds
// how long that can possibly take: a hidden window is just another way to
// look like the app never opened.
const WINDOW_REVEAL_TIMEOUT_MS = 5000;

// 'wasm-unsafe-eval' and blob: workers are required by the multi-threaded
// Stockfish build; connect-src allows the GitHub update check.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://api.github.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

function handleRequest(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  const filePath = path.normalize(
    path.join(DIST_PATH, urlPath === '/' ? '/index.html' : urlPath)
  );

  // Resolve must stay inside dist/ — the separator suffix prevents
  // sibling-directory bypasses like "dist-evil".
  if (filePath !== DIST_PATH && !filePath.startsWith(DIST_PATH + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }

    // Validators let Chromium keep responses in its HTTP cache, which is what
    // enables its compiled-WebAssembly code cache: engine restarts and later
    // launches skip recompiling the 100MB+ binary.
    const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ETag: etag,
      // Required for SharedArrayBuffer, which the multi-threaded
      // Stockfish build needs to spawn its pthread workers.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
    };

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }

    headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    // Stream rather than readFileSync: the engine binary is 100MB+ and a
    // synchronous read would stall the main process.
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`The local server did not start within ${SERVER_START_TIMEOUT_MS / 1000}s.`)),
      SERVER_START_TIMEOUT_MS
    );
    const settle = (fn) => (value) => {
      clearTimeout(timer);
      fn(value);
    };
    resolve = settle(resolve);
    reject = settle(reject);

    const server = http.createServer(handleRequest);
    const listen = (port) => server.listen(port, '127.0.0.1');
    server.once('listening', () => resolve(server.address().port));
    let triedFallback = false;
    server.on('error', (err) => {
      if (!triedFallback && server.address() === null) {
        triedFallback = true;
        console.warn(`[server] port ${PREFERRED_PORT} unavailable (${err.code}); using a random port`);
        listen(0);
      } else {
        reject(err);
      }
    });
    listen(PREFERRED_PORT);
  });
}

// The multi-threaded Stockfish build needs SharedArrayBuffer. The server's
// COOP/COEP headers make browsers cross-origin isolate the page, but
// Electron's BrowserWindow doesn't reliably honor them (crossOriginIsolated
// stays false), which left SharedArrayBuffer undefined and the engine unable
// to start. Enable it explicitly; must run before the app is ready.
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

let appOrigin = null;

// Size the window to whatever the page actually needs, capped to the display's
// work area. Measuring beats a hardcoded height: the analysis panel's height
// depends on the saved "lines" setting, so no single default suits every user.
async function fitToContent(win) {
  let width = CONTENT_WIDTH;
  let height = FALLBACK_CONTENT_HEIGHT;
  try {
    const measured = await win.webContents.executeJavaScript(
      `(() => {
         const app = document.querySelector('.app');
         const bottom = app ? app.getBoundingClientRect().bottom + window.scrollY : 0;
         return {
           width: Math.ceil(Math.max(app ? app.scrollWidth : 0, document.documentElement.scrollWidth)),
           height: Math.ceil(bottom),
         };
       })()`
    );
    if (measured && measured.height > 0) {
      width = Math.max(width, measured.width);
      height = measured.height + CONTENT_BOTTOM_GUTTER;
    }
  } catch {
    /* fall back to the constants above */
  }

  const { workAreaSize } = screen.getDisplayNearestPoint(win.getBounds());
  width = Math.max(MIN_CONTENT_WIDTH, Math.min(width, workAreaSize.width));
  height = Math.max(MIN_CONTENT_HEIGHT, Math.min(height, workAreaSize.height));

  console.log(`[window] content ${width}x${height} (work area ${workAreaSize.width}x${workAreaSize.height})`);
  win.setContentSize(width, height);
  win.center();

  // The whole point is opening without a scrollbar, so say so when the fit
  // failed - which on a short display is expected and unavoidable.
  try {
    const overflow = await win.webContents.executeJavaScript(
      'document.documentElement.scrollHeight - document.documentElement.clientHeight'
    );
    if (overflow > 0) {
      console.warn(`[window] content still overflows by ${overflow}px after fitting`);
    }
  } catch {
    /* diagnostic only */
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: CONTENT_WIDTH,
    height: FALLBACK_CONTENT_HEIGHT,
    minWidth: MIN_CONTENT_WIDTH,
    minHeight: MIN_CONTENT_HEIGHT,
    title: 'Chess Solver',
    // Stay hidden until it has been sized, so there is no visible resize jump.
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  let shown = false;
  const reveal = () => {
    if (shown) return;
    shown = true;
    win.show();
  };
  const revealTimer = setTimeout(reveal, WINDOW_REVEAL_TIMEOUT_MS);
  win.on('closed', () => clearTimeout(revealTimer));

  win.webContents.once('did-finish-load', async () => {
    try {
      await fitToContent(win);
    } finally {
      clearTimeout(revealTimer);
      reveal();
    }
  });

  // External links (e.g. release downloads from the update check) open in
  // the system browser; the window itself never navigates away or spawns
  // child windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(appOrigin)) {
      event.preventDefault();
      if (url.startsWith('https://')) {
        shell.openExternal(url);
      }
    }
  });

  win.setMenuBarVisibility(false);
  win.loadURL(appOrigin);

  if (process.env.CHESS_SOLVER_DEVTOOLS) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

// The running instance records where to reach it. Advisory only: every read
// and write is best-effort, and a missing or stale file simply means the probe
// below reports the instance as unreachable.
function instanceFile() {
  return path.join(app.getPath('userData'), 'instance.json');
}

function writeInstanceRecord(port) {
  try {
    fs.writeFileSync(instanceFile(), JSON.stringify({ port, pid: process.pid }));
  } catch {
    /* not worth failing a launch over */
  }
}

function clearInstanceRecord() {
  try {
    fs.unlinkSync(instanceFile());
  } catch {
    /* already gone */
  }
}

function readInstanceRecord() {
  try {
    const record = JSON.parse(fs.readFileSync(instanceFile(), 'utf8'));
    return typeof record.port === 'number' ? record : null;
  } catch {
    return null;
  }
}

function probeOnce(port) {
  return new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/', method: 'HEAD', timeout: PROBE_TIMEOUT_MS },
      (res) => {
        res.resume();
        resolve(true);
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

// Whether the instance holding the lock is actually serving. A healthy primary
// answers and raises its own window, which makes this launch redundant.
async function primaryIsResponding() {
  const record = readInstanceRecord();
  if (!record) return false;
  for (let i = 0; i < PROBE_ATTEMPTS; i++) {
    if (await probeOnce(record.port)) return true;
    await new Promise((done) => setTimeout(done, PROBE_INTERVAL_MS));
  }
  return false;
}

// One instance at a time: a second launch would start a second engine
// competing for the same CPU cores. Focus the existing window instead.
const gotInstanceLock = app.requestSingleInstanceLock();
if (gotInstanceLock) {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    } else if (appOrigin !== null) {
      createWindow();
    }
  });
  app.on('will-quit', clearInstanceRecord);
}

// Losing the lock used to mean app.quit() and a silent disappearance. When the
// instance holding the lock was wedged - windowless, or still starting - that
// was indistinguishable from the app refusing to open, with nothing on screen
// to explain it. Stay quiet only after confirming the running instance is
// alive and therefore about to surface its own window.
async function deferToRunningInstance() {
  if (await primaryIsResponding()) {
    app.exit(0);
    return;
  }
  dialog.showErrorBox(
    'Chess Solver is already running',
    'Another copy of Chess Solver is running but is not responding, so this launch was stopped.\n\n' +
      'End any "Chess Solver" entries in Task Manager, then start Chess Solver again.\n\n' +
      'From a terminal: taskkill /IM "Chess Solver.exe" /F'
  );
  app.exit(1);
}

app.whenReady().then(async () => {
  if (!gotInstanceLock) {
    await deferToRunningInstance();
    return;
  }
  try {
    const port = await startServer();
    appOrigin = `http://127.0.0.1:${port}`;
    writeInstanceRecord(port);
    createWindow();
  } catch (err) {
    // Never linger as a windowless background process: it would hold the
    // single-instance lock and make every later launch silently do nothing.
    dialog.showErrorBox(
      'Chess Solver could not start',
      `The app's local server failed to start:\n\n${err && err.message ? err.message : err}`
    );
    app.exit(1);
  }
});

// macOS convention: the app stays alive with no windows and reopens one when
// its Dock icon is activated; everywhere else, closing the window quits.
app.on('activate', () => {
  if (appOrigin !== null && BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
