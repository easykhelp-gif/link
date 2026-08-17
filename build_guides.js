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
      
      const currTitle = lang === 'en' ? guide.title_en : (lang === 'th' ? guide.title_th : guide.title_vi);
      html = html.replace(/\{\{TITLE\}\}/g, currTitle || guide.title_en || '');
      html = html.replace(/\{\{DATE\}\}/g, guide.date || '');
      
      const imgUrl = (guide.image && guide.image.startsWith('news/')) ? '/link/' + guide.image : (guide.image || '');
      html = html.replace(/\{\{IMAGE_URL\}\}/g, imgUrl);
      
      let catName = guide.tag ? guide.tag : (guide.category.charAt(0).toUpperCase() + guide.category.slice(1));
      html = html.replace(/\{\{CATEGORY_NAME\}\}/g, catName);
      
      const currContent = lang === 'en' ? guide.content_en : (lang === 'th' ? guide.content_th : guide.content_vi);
      let contentHtml = currContent || '';
      contentHtml = contentHtml.replace(/src="news\//g, 'src="/link/news/');
      contentHtml = contentHtml.replace(/href="news\//g, 'href="/link/news/');
      html = html.replace(/\{\{CONTENT\}\}/g, contentHtml);

      html = html.replace(/\{\{CATEGORY\}\}/g, guide.category);
      html = html.replace(/\{\{ID\}\}/g, guide.id);
      
      let currLangName = '';
      let otherLangLinks = '';
      
      if (lang === 'en') {
        currLangName = 'English';
        otherLangLinks = `
          <a href="/link/th/guides/${guide.category}/${guide.id}/" class="lang-option">ภาษาไทย</a>
          <a href="/link/vi/guides/${guide.category}/${guide.id}/" class="lang-option">Tiếng Việt</a>
        `;
      } else if (lang === 'th') {
        currLangName = 'ภาษาไทย';
        otherLangLinks = `
          <a href="/link/en/guides/${guide.category}/${guide.id}/" class="lang-option">English</a>
          <a href="/link/vi/guides/${guide.category}/${guide.id}/" class="lang-option">Tiếng Việt</a>
        `;
      } else if (lang === 'vi') {
        currLangName = 'Tiếng Việt';
        otherLangLinks = `
          <a href="/link/en/guides/${guide.category}/${guide.id}/" class="lang-option">English</a>
          <a href="/link/th/guides/${guide.category}/${guide.id}/" class="lang-option">ภาษาไทย</a>
        `;
      }
      
      html = html.replace(/\{\{CURRENT_LANG_NAME\}\}/g, currLangName);
      html = html.replace(/\{\{OTHER_LANG_LINKS\}\}/g, otherLangLinks);

      let homeUrl = `/link/${lang}/index.html`;
      if (lang === 'en') {
        homeUrl = '/link/index.html';
      }
      html = html.replace(/\{\{LANG_HOME_URL\}\}/g, homeUrl);

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
  <p><a href="/link/index.html" style="color: #64748b; text-decoration: none;">&larr; Back to Home</a></p>
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
      let thumb = item.image || 'https://www.koricare.kr/link/koricare_main_logo_nobg.png';
      if (thumb.startsWith('news/')) thumb = '/link/' + thumb;
      const title = item.title_en || item.title_ko || item.title_th || item.title_vi;
      let badgeHtml = item.tag ? `<div style="font-size:11px; font-weight:800; color:#2563eb; background:#eff6ff; padding:2px 6px; border-radius:4px; margin-bottom:4px; display:inline-block;">${item.tag}</div>` : '';
      const dateStr = item.date || '';
      
      return `    <a href="en/guides/${item.category}/${item.id}/" class="list-item-card" style="display:flex; flex-direction:row; padding:14px 0; border-bottom:1px solid var(--line); text-decoration:none; transition:all 0.2s ease; align-items:center;">
      <div class="list-thumb" style="width:96px; height:72px; flex-shrink:0; border-radius:12px; background:#f1f5f9; overflow:hidden; margin-right:14px;">
        <img src="${thumb}" alt="${title}" onerror="this.onerror=null;this.src='https://www.koricare.kr/link/koricare_main_logo_nobg.png';" style="width:100%; height:100%; object-fit:cover; display:block;">
      </div>
      <div style="display:flex; flex-direction:column; flex:1; justify-content:center;">
        <div>${badgeHtml}</div>
        <div class="list-title" style="font-size:16px; font-weight:700; color:var(--ink); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word;">${title}</div>
        <div style="font-size:13px; color:var(--sub); margin-top:6px; font-weight:500;">Kori Care Guide &middot; ${dateStr}</div>
      </div>
    </a>`;
    }).join('\n');

    const updated = content.slice(0, sIdx + startM.length) + 
      '\n  <div class="news-list" id="guide-list" style="display:flex; flex-direction:column; margin-bottom:28px;">\n' + 
      cardsHtml + 
      '\n  </div>\n  ' + content.slice(eIdx);
    
    fs.writeFileSync(INDEX_PATH, updated, 'utf-8');
    
    // Also update th/index.html and vi/index.html
    ['th', 'vi'].forEach(lang => {
      const p = path.join(BASE_DIR, lang, 'index.html');
      if (fs.existsSync(p)) {
        let c = fs.readFileSync(p, 'utf-8');
        let langCards = top3.map(item => {
          let thumb = item.image || 'https://www.koricare.kr/link/koricare_main_logo_nobg.png';
          if (thumb.startsWith('news/')) thumb = '/link/' + thumb;
          const title = (lang === 'th' ? item.title_th : item.title_vi) || item.title_en;
          let badgeHtml = item.tag ? `<div style="font-size:11px; font-weight:800; color:#2563eb; background:#eff6ff; padding:2px 6px; border-radius:4px; margin-bottom:4px; display:inline-block;">${item.tag}</div>` : '';
          const dateStr = item.date || '';

          return `    <a href="guides/${item.category}/${item.id}/" class="list-item-card" style="display:flex; flex-direction:row; padding:14px 0; border-bottom:1px solid var(--line); text-decoration:none; transition:all 0.2s ease; align-items:center;">
          <div class="list-thumb" style="width:96px; height:72px; flex-shrink:0; border-radius:12px; background:#f1f5f9; overflow:hidden; margin-right:14px;">
            <img src="${thumb}" alt="${title}" onerror="this.onerror=null;this.src='https://www.koricare.kr/link/koricare_main_logo_nobg.png';" style="width:100%; height:100%; object-fit:cover; display:block;">
          </div>
          <div style="display:flex; flex-direction:column; flex:1; justify-content:center;">
            <div>${badgeHtml}</div>
            <div class="list-title" style="font-size:16px; font-weight:700; color:var(--ink); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word;">${title}</div>
            <div style="font-size:13px; color:var(--sub); margin-top:6px; font-weight:500;">Kori Care Guide &middot; ${dateStr}</div>
          </div>
        </a>`;
        }).join('\n');
        
        let up = c.slice(0, c.indexOf(startM) + startM.length) + 
          '\n  <div class="news-list" id="guide-list" style="display:flex; flex-direction:column; margin-bottom:28px;">\n' + 
          langCards + 
          '\n  </div>\n  ' + c.slice(c.indexOf(endM));
        fs.writeFileSync(p, up, 'utf-8');
      }
    });

    console.log('[Success] index.html and lang/index.html guide cards synced!');
  }
}

buildGuides();
