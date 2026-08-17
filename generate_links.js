const fs = require('fs');
const path = require('path');

const regions = [
  { id: 'seoul', name: 'Seoul (서울)' },
  { id: 'busan', name: 'Busan (부산)' },
  { id: 'daegu', name: 'Daegu (대구)' },
  { id: 'incheon', name: 'Incheon (인천)' },
  { id: 'gwangju', name: 'Gwangju (광주)' },
  { id: 'daejeon', name: 'Daejeon (대전)' },
  { id: 'ulsan', name: 'Ulsan (울산)' },
  { id: 'sejong', name: 'Sejong (세종)' },
  { id: 'gyeonggi', name: 'Gyeonggi (경기)' },
  { id: 'gangwon', name: 'Gangwon (강원)' },
  { id: 'chungbuk', name: 'Chungbuk (충북)' },
  { id: 'chungnam', name: 'Chungnam (충남)' },
  { id: 'jeonbuk', name: 'Jeonbuk (전북)' },
  { id: 'jeonnam', name: 'Jeonnam (전남)' },
  { id: 'gyeongbuk', name: 'Gyeongbuk (경북)' },
  { id: 'gyeongnam', name: 'Gyeongnam (경남)' },
  { id: 'jeju', name: 'Jeju (제주)' }
];

let html = `  <!-- Local Directory Section -->
  <div class="local-directory-section" style="margin: 36px 0 16px;">
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="width:4px; height:26px; background:linear-gradient(180deg, #002366 0%, #2563eb 100%); border-radius:4px;"></div>
      <div>
        <div style="font-size:22px; font-weight:900; color:#002366; line-height:1.2; letter-spacing:-0.3px;">Local Directory</div>
        <div style="font-size:13px; color:#64748b; font-weight:500; margin-top:2px;">Explore restaurants, Asian markets, and support centers by region</div>
      </div>
    </div>
    <div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">\n`;

regions.forEach(r => {
  html += `
      <details style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:10px;">
        <summary style="font-weight:800; font-size:15px; color:#002366; cursor:pointer; list-style:none; outline:none;">
          ${r.name}
        </summary>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-top:12px;">
          <a href="${r.id}/restaurant/" class="card-item" style="padding:10px; font-size:12px; font-weight:700; text-align:center; text-decoration:none; color:#002366; background:#fff; border:1px solid #e2e8f0; border-radius:8px;">Restaurants</a>
          <a href="${r.id}/support/" class="card-item" style="padding:10px; font-size:12px; font-weight:700; text-align:center; text-decoration:none; color:#002366; background:#fff; border:1px solid #e2e8f0; border-radius:8px;">Support Centers</a>
          <a href="${r.id}/government/" class="card-item" style="padding:10px; font-size:12px; font-weight:700; text-align:center; text-decoration:none; color:#002366; background:#fff; border:1px solid #e2e8f0; border-radius:8px;">Government</a>
        </div>
      </details>\n`;
});

html += `    </div>
  </div>`;

const files = [
    'th/index.html',
    'vi/index.html'
];

// In th and vi files, the banner comment is <!-- Official Banner -->
const pattern = /[\s]*<!-- Local Directory Section -->[\s\S]*?(?=<!-- Official Banner -->)/;

files.forEach(f => {
    const fullPath = path.join(__dirname, f);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    if (content.match(pattern)) {
       content = content.replace(pattern, '\n' + html + '\n\n    ');
       fs.writeFileSync(fullPath, content, 'utf8');
       console.log(`Updated ${f}`);
    } else {
       console.log(`Pattern not found in ${f}`);
    }
});
