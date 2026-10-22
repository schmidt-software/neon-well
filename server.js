const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/game.js': ['game.js', 'text/javascript; charset=utf-8'],
  '/engine.js': ['engine.js', 'text/javascript; charset=utf-8'],
  '/audio.js': ['audio.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/lib/three.module.js': ['lib/three.module.js', 'text/javascript; charset=utf-8'],
  '/lib/three.core.js': ['lib/three.core.js', 'text/javascript; charset=utf-8'],
  '/lib/OrbitControls.js': ['lib/OrbitControls.js', 'text/javascript; charset=utf-8'],
};
const port = Number(process.env.PORT || 8123);
const server = http.createServer((request, response) => {
  const file = files[request.url.split('?')[0]];
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  fs.readFile(path.join(__dirname, file[0]), (error, data) => {
    if (error) {
      console.error(error);
      response.writeHead(500);
      response.end('Unable to load game assets');
      return;
    }
    response.writeHead(200, { 'Content-Type': file[1] });
    response.end(data);
  });
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Neon Well: http://localhost:${port}`));
