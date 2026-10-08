// Minimal static file server for the tests (the game has no build step).
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 8123;
const types = {
   '.html': 'text/html; charset=utf-8',
   '.css': 'text/css',
   '.js': 'text/javascript',
   '.png': 'image/png',
   '.ogg': 'audio/ogg'
};

http.createServer(function(req, res) {
   let urlPath;
   try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
   } catch (e) {
      // Malformed escapes such as /%ZZ.
      res.writeHead(400);
      return res.end('bad request');
   }
   const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
   if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
   }
   fs.readFile(file, function(err, data) {
      if (err) {
         res.writeHead(404);
         return res.end('not found');
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
   });
}).listen(port, '127.0.0.1');
