const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const GUIDES_LIST_PATH = path.join(DATA_DIR, 'guides_list.json');
const TEMPLATE_PATH = path.join(BASE_DIR, 'templates', 'guide_template.html');
const INDEX_PATH = path.join(BASE_DIR, 'index.html');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function buildGuides() {
  if (!fs.existsSync(GUIDES_LIST_PATH)) {
    console.log('[Info] No guides_list.json found. Skipping guides build.');
    return;
  }
  
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error('[Error] templates/guide_template.html missing. Cannot build guides.');
    return;
  }

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  let guides = [];
  try {
    guides = JSON.parse(fs.readFileSync(GUIDES_LIST_PATH, 'utf-8'));
  } catch (e) {
    console.error('[Error] Invalid JSON in guides_list.json', e);
    return;
  }

  // Create guides directory
  ensureDir(path.join(BASE_DIR, 'guides'));

  guides.forEach(guide => {
    const categoryDir = path.join(BASE_DIR, 'guides', guide.category);
    ensureDir(categoryDir);
    
    let html = template;
    
    // Replace placeholders
    html = html.replace(/\{\{GUIDE_ID\}\}/g, guide.category + '/' + guide.id);
    html = html.replace(/\{\{TITLE_EN\}\}/g, guide.title_en || '');
    html = html.replace(/\{\{DATE\}\}/g, guide.date || '');
    html = html.replace(/\{\{IMAGE_URL\}\}/g, guide.image || '');
    
    // Capitalize category or use tag
    let catName = guide.tag ? guide.tag : (guide.category.charAt(0).toUpperCase() + guide.category.slice(1));
    html = html.replace(/\{\{CATEGORY_NAME\}\}/g, catName);
    
    html = html.replace(/\{\{CONTENT_EN\}\}/g, guide.content_en || '');
    html = html.replace(/\{\{CONTENT_TH\}\}/g, guide.content_th || '');
    html = html.replace(/\{\{CONTENT_VI\}\}/g, guide.content_vi || '');
    html = html.replace(/\{\{CONTENT_KO\}\}/g, guide.content_ko || '');

    html = html.replace(/\{\{TITLE_EN_JSON\}\}/g, JSON.stringify(guide.title_en || ''));
    html = html.replace(/\{\{TITLE_TH_JSON\}\}/g, JSON.stringify(guide.title_th || ''));
    html = html.replace(/\{\{TITLE_VI_JSON\}\}/g, JSON.stringify(guide.title_vi || ''));
    html = html.replace(/\{\{TITLE_KO_JSON\}\}/g, JSON.stringify(guide.title_ko || ''));

    const outputPath = path.join(categoryDir, guide.id + '.html');
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`[Success] Generated guide: ${outputPath}`);
  });

  updateIndexHtml(guides);
}

function updateIndexHtml(guides) {
  if (!fs.existsSync(INDEX_PATH)) return;
  
  let content = fs.readFileSync(INDEX_PATH, 'utf-8');
  const startM = '<!-- GUIDE_START -->';
  const endM = '<!-- GUIDE_END -->';
  const sIdx = content.indexOf(startM);
  const eIdx = content.indexOf(endM);

  if (sIdx !== -1 && eIdx !== -1) {
    // Sort by date descending
    const sortedGuides = guides.slice().sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });

    // Take top 3 latest guides
    const top3 = sortedGuides.slice(0, 3);
    const cardsHtml = top3.map(item => {
      const thumb = item.image || 'https://www.koricare.kr/link/koricare_main_logo_nobg.png';
      const title = item.title_en || item.title_ko || item.title_th || item.title_vi;
      let tagHtml = item.tag ? `<div style="position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; font-weight:700; padding:3px 8px; border-radius:4px; backdrop-filter:blur(4px);">${item.tag}</div>` : '';
      
      return `    <a href="guides/${item.category}/${item.id}.html" class="news-card" style="display:flex; flex-direction:column; background:#fff; border-radius:14px; text-decoration:none; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(15,23,42,0.03); overflow:hidden; transition:all 0.2s ease; position:relative;">
      <div style="width:100%; height:130px; background:#f8fafc; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;">
        <img src="${thumb}" alt="${title}" onerror="this.onerror=null;this.src='https://www.koricare.kr/link/koricare_main_logo_nobg.png';" style="width:100%; height:100%; object-fit:contain; display:block;">
        ${tagHtml}
      </div>
      <div style="padding:12px 14px; display:flex; flex-direction:column; flex:1; justify-content:flex-start;">
        <div style="font-size:13.5px; font-weight:800; color:#0f172a; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word;">${title}</div>
      </div>
    </a>`;
    }).join('\n');

    const updated = content.slice(0, sIdx + startM.length) + 
      '\n  <div class="news-grid" id="guide-list" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:28px;">\n' + 
      cardsHtml + 
      '\n  </div>\n  ' + content.slice(eIdx);
    
    fs.writeFileSync(INDEX_PATH, updated, 'utf-8');
    console.log('[Success] index.html horizontal guide cards synced!');
  } else {
    console.log('[Warning] <!-- GUIDE_START --> or <!-- GUIDE_END --> not found in index.html');
  }

  // Update Sitemap
  const SITEMAP_PATH = path.join(BASE_DIR, 'sitemap.xml');
  if (fs.existsSync(SITEMAP_PATH)) {
    let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf-8');
    if (sitemap.includes('</urlset>')) {
      const urls = guides.map(g => {
        return `  <url>\n    <loc>https://www.koricare.kr/link/guides/${g.category}/${g.id}.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
      }).join('\n');
      sitemap = sitemap.replace('</urlset>', urls + '\n</urlset>');
      fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf-8');
      console.log('[Success] sitemap.xml updated with guides!');
    }
  }
}

buildGuides();
