const fs = require('fs');
const path = require('path');

const thPath = path.join(__dirname, 'th/index.html');
const viPath = path.join(__dirname, 'vi/index.html');

function fixHtml(filepath, guideTitle, newsTitle, searchPlaceholder, searchPopular) {
  let content = fs.readFileSync(filepath, 'utf-8');
  
  const calcStart = content.indexOf('<!-- Severance Pay Calculator Card -->');
  const localDir = content.indexOf('<!-- Local Directory Section -->');
  
  if (calcStart === -1 || localDir === -1) {
    console.log('Markers missing in', filepath);
    return;
  }
  
  const calcToNewsBlock = `<!-- Severance Pay Calculator Card -->
  <a class="kc-calc-card" href="severance-calculator">
    <span class="kc-calc-ic">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="3" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="10" y2="14" />
        <line x1="14" y1="14" x2="16" y2="14" />
        <line x1="8" y1="18" x2="10" y2="18" />
        <line x1="14" y1="18" x2="16" y2="18" />
      </svg>
    </span>
    <span class="kc-calc-tx">
      <span class="t">${filepath.includes('vi') ? 'Tính trợ cấp thôi việc' : 'คำนวณเงินชดเชยของคุณ'}</span>
      <span class="sub">${filepath.includes('vi') ? 'Tính ước lượng khoản trợ cấp thôi việc theo Luật Lao động Hàn Quốc' : 'คำนวณเงินชดเชยที่ประเมินตามกฎหมายแรงงานเกาหลี'}</span>
    </span>
    <span class="kc-calc-arrow">➔</span>
  </a>

  <!-- Search Box -->
  <div class="search" onclick="document.getElementById('searchOverlay').style.display='block'; document.getElementById('overlayQ').focus();">
    <span class="ic">🔍</span>
    <input id="q" type="text" placeholder="${searchPlaceholder}" readonly style="cursor: pointer;">
  </div>
  <div class="hot" id="hot">
    <b>${searchPopular}</b>
  </div>

  <!-- Recent News Section -->
  <div style="display:flex; align-items:center; gap:10px; margin: 36px 0 16px;">
    <div style="width:4px; height:26px; background:linear-gradient(180deg, #002366 0%, #2563eb 100%); border-radius:4px;"></div>
    <div>
      <div style="font-size:22px; font-weight:900; color:#002366; line-height:1.2; letter-spacing:-0.3px;">${newsTitle}</div>
    </div>
  </div>

  <!-- NEWS_START -->
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

  content = content.slice(0, calcStart) + calcToNewsBlock + content.slice(localDir);
  fs.writeFileSync(filepath, content, 'utf-8');
  console.log('Fixed structure for', filepath);
}

fixHtml(thPath, 'Korea Guide (เกาหลีไกด์)', 'ข่าวสารล่าสุด (Recent News)', 'ค้นหาบริการ (เช่น วีซ่า โอนเงิน โรงพยาบาล)', 'คำค้นหายอดนิยม:');
fixHtml(viPath, 'Korea Guide (Hướng dẫn Hàn Quốc)', 'Tin tức mới nhất (Recent News)', 'Tìm kiếm dịch vụ (Ví dụ: Visa, Chuyển tiền, Bệnh viện)', 'Từ khóa phổ biến:');
