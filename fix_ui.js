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

let seoLinks = '';
regions.forEach(r => {
  seoLinks += `
        <div style="margin-bottom:12px;">
          <div style="font-weight:700; font-size:13px; color:#475569; margin-bottom:4px;">${r.name}</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <a href="${r.id}/restaurant/" style="font-size:12px; color:#2563eb; text-decoration:none;">Restaurants</a>
            <span style="color:#cbd5e1;">|</span>
            <a href="${r.id}/support/" style="font-size:12px; color:#2563eb; text-decoration:none;">Support</a>
            <span style="color:#cbd5e1;">|</span>
            <a href="${r.id}/government/" style="font-size:12px; color:#2563eb; text-decoration:none;">Government</a>
          </div>
        </div>`;
});

const originalGoodUI = `  <!-- Local Directory Section -->
  <div class="local-directory-section" style="margin: 36px 0 16px;">
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="width:4px; height:26px; background:linear-gradient(180deg, #002366 0%, #2563eb 100%); border-radius:4px;"></div>
      <div>
        <div style="font-size:22px; font-weight:900; color:#002366; line-height:1.2; letter-spacing:-0.3px;">Local Directory</div>
        <div style="font-size:13px; color:#64748b; font-weight:500; margin-top:2px;">Filter hospitals, clinics, and Asian markets by region</div>
      </div>
    </div>

    <div class="local-filter-group" id="groupRegions" style="margin-bottom: 12px; margin-top: 16px;">
      <div style="position:relative; width:100%;">
        <select id="regionDropdown" style="width:100%; font-size:14.5px; font-weight:700; padding:12px 16px; border-radius:14px; border:1.5px solid var(--line); background:#ffffff; color:var(--navy); outline:none; cursor:pointer; appearance:none; -webkit-appearance:none; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
        </select>
        <span style="position:absolute; right:16px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--navy); font-size:13px; font-weight:800;">▼</span>
      </div>
    </div>

    <div id="localGrid" style="margin-top:16px; display:flex; flex-direction:column; width:100%;"></div>

  </div>`;

const files = [
    { file: 'index.html', pattern: /[\s]*<!-- Local Directory Section -->[\s\S]*?(?=<!-- Kori Care Official Banner)/ },
    { file: 'th/index.html', pattern: /[\s]*<!-- Local Directory Section -->[\s\S]*?(?=<!-- Official Banner)/ },
    { file: 'vi/index.html', pattern: /[\s]*<!-- Local Directory Section -->[\s\S]*?(?=<!-- Official Banner)/ }
];

files.forEach(({ file, pattern }) => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) return;
    let content = fs.readFileSync(fullPath, 'utf8');
    
    if (content.match(pattern)) {
       content = content.replace(pattern, '\n' + originalGoodUI + '\n\n  ');
       fs.writeFileSync(fullPath, content, 'utf8');
       console.log(`Updated ${file}`);
    } else {
       console.log(`Pattern not found in ${file}`);
    }
});
