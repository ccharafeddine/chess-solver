const { app, BrowserWindow, shell } = require('electron');
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
};

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

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
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

      try {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          // Required for SharedArrayBuffer, which the multi-threaded
          // Stockfish build needs to spawn its pthread workers.
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Resource-Policy': 'same-origin',
          'Content-Security-Policy': CSP,
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

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

app.whenReady().then(async () => {
  const port = await startServer();
  appOrigin = `http://127.0.0.1:${port}`;
  createWindow();
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
