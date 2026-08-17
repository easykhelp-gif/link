const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const output = execSync('git log --since="30 days ago" --diff-filter=A --name-only --oneline -- news/images/').toString();
  const files = output.split('\n').filter(l => l.endsWith('.jpg') || l.endsWith('.png'));
  
  let totalBytes = 0;
  let count = 0;
  files.forEach(f => {
    try {
      // some lines might have commit hash, extract just the file path
      const parts = f.split(' ');
      const filepath = parts[parts.length - 1].trim();
      const stats = fs.statSync(filepath);
      totalBytes += stats.size;
      count++;
    } catch(e) {}
  });
  
  console.log('Added in last 30 days:', count, 'files');
  console.log('Total bytes:', totalBytes, 'bytes');
  console.log('Average per day:', (totalBytes / 30 / 1024 / 1024).toFixed(3), 'MB');
} catch(e) { console.error(e); }
