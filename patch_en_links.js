const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else if (file.endsWith('.html')) {
            results.push(file);
        }
    });
    return results;
}

const files = walkDir(path.join(__dirname, 'en'));
let count = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('href="/link/en/"')) {
        content = content.replace('href="/link/en/"', 'href="/link/"');
        fs.writeFileSync(file, content, 'utf8');
        count++;
    }
});
console.log("Patched files: " + count);
