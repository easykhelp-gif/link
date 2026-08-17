const fs = require('fs');
const content = fs.readFileSync('th/index.html', 'utf8');
const start = content.indexOf('<details');
const end = content.indexOf('</details>');
const block = content.slice(start, end);
const m = block.match(/href=\"([^\"]+)\"/g);
let notFound = 0;
if (m) {
  m.forEach(x => {
    let rel = x.replace('href="', '').replace('"', '');
    let p = 'th/' + rel + 'index.html';
    if (!fs.existsSync(p)) {
      console.log('404: ' + p);
      notFound++;
    }
  });
}
console.log('Total 404s: ' + notFound);
