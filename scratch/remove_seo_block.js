const fs = require('fs');

const files = ['index.html', 'th/index.html', 'vi/index.html'];

files.forEach(file => {
  let html = fs.readFileSync(file, 'utf-8');
  const startIdx = html.indexOf('<!-- SEO Links Block START -->');
  const endIdx = html.indexOf('<!-- SEO Links Block END -->');
  
  if (startIdx !== -1 && endIdx !== -1) {
    const toRemove = html.substring(startIdx, endIdx + '<!-- SEO Links Block END -->'.length);
    html = html.replace(toRemove, '');
    fs.writeFileSync(file, html, 'utf-8');
    console.log(`Cleaned SEO block from ${file}`);
  }
});
