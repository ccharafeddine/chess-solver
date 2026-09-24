const { app, BrowserWindow, dialog, shell } = require('electron');
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    title: 'Chess Solver',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
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

// One instance at a time: a second launch would start a second engine
// competing for the same CPU cores. Focus the existing window instead.
const gotInstanceLock = app.requestSingleInstanceLock();
if (!gotInstanceLock) {
  app.quit();
} else {
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
}

app.whenReady().then(async () => {
  if (!gotInstanceLock) return;
  try {
    const port = await startServer();
    appOrigin = `http://127.0.0.1:${port}`;
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
