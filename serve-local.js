import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 4000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const BASE = process.cwd();

const server = http.createServer((req, res) => {
  let filePath = path.join(BASE, req.url === '/' ? '/index.html' : req.url);
  
  // Handle SPA routing - serve index.html for non-file requests
  if (!path.extname(filePath)) {
    filePath = path.join(BASE, req.url, 'index.html');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(BASE, 'index.html');
    }
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Local server running at http://localhost:${PORT}`);
  console.log(`Serving: ${BASE}`);
});
