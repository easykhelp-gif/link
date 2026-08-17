const fs = require('fs');
const path = require('path');

const repo = __dirname;
let hasError = false;

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
    // Ignore external URLs and empty links and absolute root links that go to the main domain
    if (linkUrl.startsWith('http') || linkUrl.startsWith('//') || linkUrl.startsWith('mailto:') || linkUrl.startsWith('tel:') || !linkUrl) return;
    
    // Convert to absolute path based on file location
    let targetPath;
    if (linkUrl.startsWith('/link/')) {
      targetPath = path.join(repo, linkUrl.replace('/link/', ''));
    } else if (linkUrl.startsWith('/')) {
      // Ignored: Root level domain absolute paths not inside /link/
      return;
    } else {
      // Relative path
      targetPath = path.resolve(path.dirname(file), linkUrl);
      
      // If the linkUrl does not contain a file extension, we assume it's pointing to a directory that should have an index.html
      // Exception: # anchors
      if (linkUrl.startsWith('#')) return;
    }

    // Split anchor tags from paths
    targetPath = targetPath.split('#')[0];
    
    try {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        targetPath = path.join(targetPath, 'index.html');
        if (!fs.existsSync(targetPath)) {
          console.error(`[404 Error] ${linkType} broken in ${path.relative(repo, file)} -> ${linkUrl}`);
          hasError = true;
        }
      }
    } catch (e) {
      // File does not exist
      console.error(`[404 Error] ${linkType} broken in ${path.relative(repo, file)} -> ${linkUrl}`);
      hasError = true;
    }
  };

  while ((match = hrefRegex.exec(content)) !== null) {
    checkLink('href', match[1]);
  }
  
  while ((match = srcRegex.exec(content)) !== null) {
    checkLink('src', match[1]);
  }
});

if (hasError) {
  console.error('\n❌ Broken links found! Deployment blocked.');
  process.exit(1);
} else {
  console.log('✅ All links are valid!');
}
