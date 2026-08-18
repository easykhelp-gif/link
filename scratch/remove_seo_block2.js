const fs = require('fs');

const files = ['index.html', 'th/index.html', 'vi/index.html'];

files.forEach(file => {
  let html = fs.readFileSync(file, 'utf-8');
  
  const startIdx = html.indexOf('<!-- SEO Links Block -->');
  if (startIdx !== -1) {
    const endIdx = html.indexOf('</details>', startIdx);
    if (endIdx !== -1) {
      const toRemove = html.substring(startIdx, endIdx + '</details>'.length);
      html = html.replace(toRemove, '');
      fs.writeFileSync(file, html, 'utf-8');
      console.log(`Cleaned SEO block from ${file}`);
    } else {
      console.log(`No closing details found in ${file}`);
    }
  } else {
    console.log(`No SEO Links Block found in ${file}`);
  }
});
