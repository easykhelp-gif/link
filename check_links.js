const fs = require('fs');
const path = require('path');

const repo = __dirname;
let errorCount = 0;

// Gather all HTML files
function getAllHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    // Ignore images, git, node_modules, templates, data, scratch
    if (file === '.git' || file === 'node_modules' || file === 'images' || file === 'templates' || file === 'data' || file === 'scratch') return;
    
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllHtmlFiles(fullPath));
    } else if (file.endsWith('.html')) {
      results.push(fullPath);
    }
  });
  return results;
}

const htmlFiles = getAllHtmlFiles(repo);

console.log(`Checking ${htmlFiles.length} HTML files for broken links...`);

const hrefRegex = /href="([^"]+)"/g;
const srcRegex = /src="([^"]+)"/g;

htmlFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  let match;
  
  // Helper to check links
  const checkLink = (linkType, linkUrl) => {
    if (!linkUrl || linkUrl.startsWith('mailto:') || linkUrl.startsWith('tel:') || linkUrl.startsWith('#')) return;
    
    // Convert to absolute path based on file location
    let targetPath;
    if (linkUrl.startsWith('https://www.koricare.kr/link/')) {
      targetPath = path.join(repo, linkUrl.replace('https://www.koricare.kr/link/', ''));
    } else if (linkUrl.startsWith('https://koricare.kr/link/')) {
      targetPath = path.join(repo, linkUrl.replace('https://koricare.kr/link/', ''));
    } else if (linkUrl.startsWith('/link/')) {
      targetPath = path.join(repo, linkUrl.replace('/link/', ''));
    } else if (linkUrl.startsWith('http') || linkUrl.startsWith('//') || linkUrl.startsWith('/')) {
      // Ignore other external URLs and root domain absolute paths not inside /link/
      return;
    } else {
      // Relative path
      targetPath = path.resolve(path.dirname(file), linkUrl);
    }

    // Split anchor tags from paths
    targetPath = targetPath.split('#')[0];
    
    try {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        targetPath = path.join(targetPath, 'index.html');
        if (!fs.existsSync(targetPath)) {
          console.error(`[404 Error] ${linkType} broken in ${path.relative(repo, file)} -> ${linkUrl}`);
          errorCount++;
        }
      }
    } catch (e) {
      // File does not exist
      console.error(`[404 Error] ${linkType} broken in ${path.relative(repo, file)} -> ${linkUrl}`);
      errorCount++;
    }
  };

  while ((match = hrefRegex.exec(content)) !== null) {
    checkLink('href', match[1]);
  }
  
  while ((match = srcRegex.exec(content)) !== null) {
    checkLink('src', match[1]);
  }
});

if (errorCount > 0) {
  console.error(`\n❌ ${errorCount} broken links found! Deployment continues despite errors.`);
} else {
  console.log('✅ All links are valid!');
}
