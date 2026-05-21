const { app, BrowserWindow } = require('electron');
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

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(DIST_PATH, decodeURIComponent(req.url === '/' ? '/index.html' : req.url));
      filePath = path.normalize(filePath);

      if (!filePath.startsWith(DIST_PATH)) {
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

app.whenReady().then(async () => {
  const port = await startServer();

  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    title: 'Chess Solver',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadURL(`http://127.0.0.1:${port}`);

  if (process.env.CHESS_SOLVER_DEVTOOLS) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
