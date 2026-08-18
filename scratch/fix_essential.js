const fs = require('fs');

const files = [
  {
    path: 'index.html',
    replacement: `  <!-- Essential Services Grid Section -->
  <div class="essential-services-section" style="margin: 36px 0 16px;">
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="width:4px; height:26px; background:linear-gradient(180deg, #002366 0%, #2563eb 100%); border-radius:4px;"></div>
      <div>
        <div style="font-size:22px; font-weight:900; color:#002366; line-height:1.2; letter-spacing:-0.3px;">Korea Essential Services</div>
        <div style="font-size:13px; color:#64748b; font-weight:500; margin-top:2px;">Verified official, legal, immigration & emergency portal links</div>
      </div>
    </div>
  </div>
  <div style="margin: 12px 0 16px; width:100%; box-sizing:border-box;">
    <select class="form-input" id="catsDropdown" style="height:46px; font-size:14px; font-weight:700; background:#fff; width:100% !important; box-sizing:border-box; border-radius:14px; border:1.5px solid var(--line); padding:0 14px;" onchange="setNationalCat(this.value)"></select>
  </div>
  
  <div class="grid" id="grid" style="width:100%; display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;"><div class="empty">Loading...</div></div>
  <div id="natPg" class="pg" style="margin-top:20px; display:flex; justify-content:center; gap:8px;"></div>`
  },
  {
    path: 'th/index.html',
    replacement: `  <!-- Essential Services Grid Section -->
  <div class="essential-services-section" style="margin: 36px 0 16px;">
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="width:4px; height:26px; background:linear-gradient(180deg, #002366 0%, #2563eb 100%); border-radius:4px;"></div>
      <div>
        <div style="font-size:22px; font-weight:900; color:#002366; line-height:1.2; letter-spacing:-0.3px;">Korea Essential Services</div>
        <div style="font-size:13px; color:#64748b; font-weight:500; margin-top:2px;">รวมลิงก์บริการภาครัฐ, วีซ่า และความช่วยเหลือในเกาหลีใต้</div>
      </div>
    </div>
  </div>
  <div style="margin: 12px 0 16px; width:100%; box-sizing:border-box;">
    <select class="form-input" id="catsDropdown" style="height:46px; font-size:14px; font-weight:700; background:#fff; width:100% !important; box-sizing:border-box; border-radius:14px; border:1.5px solid var(--line); padding:0 14px;" onchange="setNationalCat(this.value)"></select>
  </div>
  
  <div class="grid" id="grid" style="width:100%; display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;"><div class="empty">กำลังโหลด...</div></div>
  <div id="natPg" class="pg" style="margin-top:20px; display:flex; justify-content:center; gap:8px;"></div>`
  },
  {
    path: 'vi/index.html',
    replacement: `  <!-- Essential Services Grid Section -->
  <div class="essential-services-section" style="margin: 36px 0 16px;">
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="width:4px; height:26px; background:linear-gradient(180deg, #002366 0%, #2563eb 100%); border-radius:4px;"></div>
      <div>
        <div style="font-size:22px; font-weight:900; color:#002366; line-height:1.2; letter-spacing:-0.3px;">Korea Essential Services</div>
        <div style="font-size:13px; color:#64748b; font-weight:500; margin-top:2px;">Tổng hợp liên kết dịch vụ chính thức, visa và hỗ trợ tại Hàn Quốc</div>
      </div>
    </div>
  </div>
  <div style="margin: 12px 0 16px; width:100%; box-sizing:border-box;">
    <select class="form-input" id="catsDropdown" style="height:46px; font-size:14px; font-weight:700; background:#fff; width:100% !important; box-sizing:border-box; border-radius:14px; border:1.5px solid var(--line); padding:0 14px;" onchange="setNationalCat(this.value)"></select>
  </div>
  
  <div class="grid" id="grid" style="width:100%; display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;"><div class="empty">Đang tải...</div></div>
  <div id="natPg" class="pg" style="margin-top:20px; display:flex; justify-content:center; gap:8px;"></div>`
  }
];

files.forEach(item => {
  let html = fs.readFileSync(item.path, 'utf-8');
  const startIdx = html.indexOf('<!-- Essential Services Grid Section -->');
  const endIdx = html.indexOf('<!-- SEO Links Block END -->');
  
  if (startIdx !== -1 && endIdx !== -1) {
    // Replace everything from startIdx to endIdx + '<!-- SEO Links Block END -->'.length
    // This will cleanly remove the corrupted elements including the random </details>
    const toReplace = html.substring(startIdx, endIdx + '<!-- SEO Links Block END -->'.length);
    html = html.replace(toReplace, item.replacement);
    fs.writeFileSync(item.path, html, 'utf-8');
    console.log('Fixed', item.path);
  } else {
    console.log('Could not find markers in', item.path);
  }
});
