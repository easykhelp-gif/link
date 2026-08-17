const fs = require('fs');
const path = require('path');

function fixFile(filePath, guideTitle) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  const newsStartIdx = content.indexOf('<!-- NEWS_START -->');
  const localDirIdx = content.indexOf('<!-- Local Directory Section -->');
  
  if (newsStartIdx === -1 || localDirIdx === -1) {
    console.log('Markers not found in', filePath);
    return;
  }
  
  const newBlock = `<!-- NEWS_START -->
  <!-- NEWS_END -->

  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin: 36px 0 16px;">
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="width:4px; height:24px; background:linear-gradient(180deg, #002366 0%, #2563eb 100%); border-radius:4px;"></div>
      <h2 style="font-size:20px; font-weight:900; color:#002366; letter-spacing:-0.5px;">${guideTitle}</h2>
    </div>
  </div>
  
  <!-- GUIDE_START -->
  <!-- GUIDE_END -->

  `;

  content = content.slice(0, newsStartIdx) + newBlock + content.slice(localDirIdx);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Fixed', filePath);
}

fixFile(path.join(__dirname, 'th/index.html'), 'Korea Guide (เกาหลีไกด์)');
fixFile(path.join(__dirname, 'vi/index.html'), 'Korea Guide (Hướng dẫn Hàn Quốc)');

