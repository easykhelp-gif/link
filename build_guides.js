const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const GUIDES_LIST_PATH = path.join(DATA_DIR, 'guides_list.json');
const TEMPLATE_PATH = path.join(BASE_DIR, 'templates', 'guide_template.html');
const INDEX_PATH = path.join(BASE_DIR, 'index.html');
const GUIDES_SITEMAP_PATH = path.join(DATA_DIR, 'guides_sitemap.json');

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

  const sitemapUrls = [];
  const langs = ['en', 'th', 'vi'];
  const hubLinks = { en: [], th: [], vi: [] };

  guides.forEach(guide => {
    // Generate for each language
    langs.forEach(lang => {
      const guideDir = path.join(BASE_DIR, lang, 'guides', guide.category, guide.id);
      ensureDir(guideDir);
      
      let html = template;
      
      const canonicalEn = `https://www.koricare.kr/link/en/guides/${guide.category}/${guide.id}/`;
      const canonicalTh = `https://www.koricare.kr/link/th/guides/${guide.category}/${guide.id}/`;
      const canonicalVi = `https://www.koricare.kr/link/vi/guides/${guide.category}/${guide.id}/`;
      const currCanonical = lang === 'en' ? canonicalEn : (lang === 'th' ? canonicalTh : canonicalVi);
      
      html = html.replace(/\{\{LANG\}\}/g, lang);
      html = html.replace(/\{\{CANONICAL_URL\}\}/g, currCanonical);
      html = html.replace(/\{\{CANONICAL_URL_EN\}\}/g, canonicalEn);
      html = html.replace(/\{\{CANONICAL_URL_TH\}\}/g, canonicalTh);
      html = html.replace(/\{\{CANONICAL_URL_VI\}\}/g, canonicalVi);
      
      html = html.replace(/\{\{TITLE_EN\}\}/g, guide.title_en || '');
      html = html.replace(/\{\{DATE\}\}/g, guide.date || '');
      html = html.replace(/\{\{IMAGE_URL\}\}/g, guide.image || '');
      
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

      // Fix the "Back to Main Portal" link to point to the correct language home
      html = html.replace(/href="\.\.\/\.\.\/index\.html"/g, `href="/link/${lang}/index.html"`);
      // Fix logo link
      html = html.replace(/src="\.\.\/\.\.\/koricare_main_logo_nobg\.png"/g, 'src="/link/koricare_main_logo_nobg.png"');

      const outputPath = path.join(guideDir, 'index.html');
      fs.writeFileSync(outputPath, html, 'utf-8');
      
      sitemapUrls.push({
        loc: currCanonical,
        changefreq: 'monthly',
        priority: 0.7
      });
      
      // Store link for hub page
      const title = lang === 'en' ? guide.title_en : (lang === 'th' ? guide.title_th : guide.title_vi) || guide.title_en;
      hubLinks[lang].push({
        url: currCanonical,
        title: title,
        date: guide.date
      });
    });
  });

  // Generate Hub pages
  langs.forEach(lang => {
    const hubDir = path.join(BASE_DIR, lang, 'guides');
    ensureDir(hubDir);
    
    let linksHtml = hubLinks[lang].sort((a,b) => new Date(b.date) - new Date(a.date)).map(l => 
      `<li style="margin-bottom: 10px;"><a href="${l.url}" style="color: #2563eb; text-decoration: none; font-size: 16px;">${l.title}</a> <span style="color: #64748b; font-size: 12px; margin-left: 10px;">${l.date}</span></li>`
    ).join('');
    
    const hubHtml = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kori Care Guides</title>
<link rel="canonical" href="https://www.koricare.kr/link/${lang}/guides/">
<style>
  body { font-family: "Inter", sans-serif; background: #f8fafc; color: #0f172a; padding: 20px; }
  .container { max-width: 800px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
</style>
</head>
<body>
<div class="container">
  <h1>Kori Care Guides</h1>
  <p><a href="/link/${lang}/index.html" style="color: #64748b; text-decoration: none;">&larr; Back to Home</a></p>
  <ul style="list-style-type: none; padding: 0; margin-top: 20px;">
    ${linksHtml}
  </ul>
</div>
</body>
</html>`;
    fs.writeFileSync(path.join(hubDir, 'index.html'), hubHtml, 'utf-8');
    
    sitemapUrls.push({
      loc: `https://www.koricare.kr/link/${lang}/guides/`,
      changefreq: 'weekly',
      priority: 0.8
    });
  });

  fs.writeFileSync(GUIDES_SITEMAP_PATH, JSON.stringify(sitemapUrls, null, 2), 'utf-8');
  console.log('[Success] Generated data/guides_sitemap.json');

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
    const sortedGuides = guides.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const top3 = sortedGuides.slice(0, 3);
    const cardsHtml = top3.map(item => {
      const thumb = item.image || 'https://www.koricare.kr/link/koricare_main_logo_nobg.png';
      const title = item.title_en || item.title_ko || item.title_th || item.title_vi;
      let tagHtml = item.tag ? `<div style="position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; font-weight:700; padding:3px 8px; border-radius:4px; backdrop-filter:blur(4px);">${item.tag}</div>` : '';
      
      return `    <a href="en/guides/${item.category}/${item.id}/" class="news-card" style="display:flex; flex-direction:column; background:#fff; border-radius:14px; text-decoration:none; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(15,23,42,0.03); overflow:hidden; transition:all 0.2s ease; position:relative;">
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
    
    // Also update th/index.html and vi/index.html
    ['th', 'vi'].forEach(lang => {
      const p = path.join(BASE_DIR, lang, 'index.html');
      if (fs.existsSync(p)) {
        let c = fs.readFileSync(p, 'utf-8');
        let langCards = top3.map(item => {
          const thumb = item.image || 'https://www.koricare.kr/link/koricare_main_logo_nobg.png';
          const title = (lang === 'th' ? item.title_th : item.title_vi) || item.title_en;
          let tagHtml = item.tag ? `<div style="position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; font-weight:700; padding:3px 8px; border-radius:4px; backdrop-filter:blur(4px);">${item.tag}</div>` : '';
          return `    <a href="guides/${item.category}/${item.id}/" class="news-card" style="display:flex; flex-direction:column; background:#fff; border-radius:14px; text-decoration:none; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(15,23,42,0.03); overflow:hidden; transition:all 0.2s ease; position:relative;">
          <div style="width:100%; height:130px; background:#f8fafc; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;">
            <img src="${thumb}" alt="${title}" onerror="this.onerror=null;this.src='https://www.koricare.kr/link/koricare_main_logo_nobg.png';" style="width:100%; height:100%; object-fit:contain; display:block;">
            ${tagHtml}
          </div>
          <div style="padding:12px 14px; display:flex; flex-direction:column; flex:1; justify-content:flex-start;">
            <div style="font-size:13.5px; font-weight:800; color:#0f172a; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word;">${title}</div>
          </div>
        </a>`;
        }).join('\n');
        
        let up = c.slice(0, c.indexOf(startM) + startM.length) + 
          '\n  <div class="news-grid" id="guide-list" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:28px;">\n' + 
          langCards + 
          '\n  </div>\n  ' + c.slice(c.indexOf(endM));
        fs.writeFileSync(p, up, 'utf-8');
      }
    });

    console.log('[Success] index.html and lang/index.html guide cards synced!');
  }
}

buildGuides();
