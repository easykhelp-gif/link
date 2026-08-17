const fs = require('fs');
const path = require('path');

const NEWS_DIR = path.join(__dirname, 'news');
const IMAGES_DIR = path.join(NEWS_DIR, 'images');
const MAX_AGE_DAYS = 40;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const now = Date.now();

function cleanOldFilesInDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    
    // Check if the file is older than 40 days based on birthtime
    if (stats.isFile() && (now - stats.birthtimeMs > MAX_AGE_MS)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`[Deleted] > 40 days old: ${file}`);
      } catch(e) {
        console.error(`Failed to delete ${file}:`, e);
      }
    }
  });
}

cleanOldFilesInDir(NEWS_DIR);
cleanOldFilesInDir(IMAGES_DIR);
console.log('✅ 40-day old news and image cleanup completed.');
