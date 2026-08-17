const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const BASE_DIR = __dirname;

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  
  if (urlPath.startsWith('/link/')) {
    urlPath = urlPath.slice(5); 
  }
  
  if (urlPath.endsWith('/')) {
    urlPath += 'index.html';
  } else if (!path.extname(urlPath)) {
    urlPath += '/index.html';
  }

  let filePath = path.join(BASE_DIR, urlPath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found: ' + filePath);
      return;
    }
    
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'text/html';
    if (ext === '.css') contentType = 'text/css';
    else if (ext === '.js') contentType = 'text/javascript';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.json') contentType = 'application/json';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Local preview server running at: http://localhost:${PORT}/link/en/guides/korea/severance_pay/`);
});
