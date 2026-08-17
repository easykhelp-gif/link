const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const NEWS_LIST_PATH = path.join(DATA_DIR, 'news_list.json');
const INDEX_PATH = path.join(BASE_DIR, 'index.html');
const SITEMAP_PATH = path.join(BASE_DIR, 'sitemap.xml');

function generateSitemap() {
  const xmlLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    '    <loc>https://www.koricare.kr/link</loc>',
    '    <changefreq>daily</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.koricare.kr/link/th/</loc>',
    '    <changefreq>daily</changefreq>',
    '    <priority>0.9</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.koricare.kr/link/vi/</loc>',
    '    <changefreq>daily</changefreq>',
    '    <priority>0.9</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.koricare.kr/link/severance-calculator.html</loc>',
    '    <changefreq>weekly</changefreq>',
    '    <priority>0.8</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.koricare.kr/link/th/severance-calculator.html</loc>',
    '    <changefreq>weekly</changefreq>',
    '    <priority>0.8</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.koricare.kr/link/vi/severance-calculator.html</loc>',
    '    <changefreq>weekly</changefreq>',
    '    <priority>0.8</priority>',
  ];

  const dirSitemapPath = path.join(DATA_DIR, 'directory_sitemap.json');
  if (!fs.existsSync(dirSitemapPath)) {
    console.error('[Error] directory_sitemap.json is missing. Fail-hard triggered.');
    process.exit(1);
  }
  
  let dirUrls;
  try {
    dirUrls = JSON.parse(fs.readFileSync(dirSitemapPath, 'utf-8'));
  } catch (e) {
    console.error('[Error] directory_sitemap.json is invalid. Fail-hard triggered.');
    process.exit(1);
  }

  if (!Array.isArray(dirUrls) || dirUrls.length < 99) {
    console.error('[Error] directory_sitemap.json has fewer than 99 entries. Fail-hard triggered.');
    process.exit(1);
  }

  dirUrls.forEach(d => {
    xmlLines.push('  <url>');
    xmlLines.push(`    <loc>${d.loc}</loc>`);
    xmlLines.push(`    <lastmod>${d.lastmod}</lastmod>`);
    xmlLines.push(`    <changefreq>${d.changefreq}</changefreq>`);
    xmlLines.push(`    <priority>${d.priority}</priority>`);
    xmlLines.push('  </url>');
  });

  const guidesSitemapPath = path.join(DATA_DIR, 'guides_sitemap.json');
  if (fs.existsSync(guidesSitemapPath)) {
    try {
      const guideUrls = JSON.parse(fs.readFileSync(guidesSitemapPath, 'utf-8'));
      if (Array.isArray(guideUrls)) {
        guideUrls.forEach(urlObj => {
          xmlLines.push('  <url>');
          xmlLines.push(`    <loc>${urlObj.loc}</loc>`);
          if (urlObj.lastmod) xmlLines.push(`    <lastmod>${urlObj.lastmod}</lastmod>`);
          if (urlObj.changefreq) xmlLines.push(`    <changefreq>${urlObj.changefreq}</changefreq>`);
          if (urlObj.priority) xmlLines.push(`    <priority>${urlObj.priority}</priority>`);
          xmlLines.push('  </url>');
        });
      }
    } catch(e) {
      console.error('[Warning] guides_sitemap.json is invalid, skipping guides in sitemap.');
    }
  }

  xmlLines.push('</urlset>');

  fs.writeFileSync(SITEMAP_PATH, xmlLines.join('\n'), 'utf-8');
  console.log('[Success] sitemap.xml updated successfully!');
}

function syncNewsIndex() {
  if (!fs.existsSync(NEWS_LIST_PATH)) return;
  const newsList = JSON.parse(fs.readFileSync(NEWS_LIST_PATH, 'utf-8'));
  const top3 = newsList.slice(0, 3);

  const langs = ['', 'th/', 'vi/'];
  
  langs.forEach(lang => {
    const langPath = path.join(BASE_DIR, lang, 'index.html');
    if (!fs.existsSync(langPath)) return;
    
    let content = fs.readFileSync(langPath, 'utf-8');
    const startM = '<!-- NEWS_START -->';
    const endM = '<!-- NEWS_END -->';
    const sIdx = content.indexOf(startM);
    const eIdx = content.indexOf(endM);

    if (sIdx !== -1 && eIdx !== -1) {
      const cardsHtml = top3.map(item => {
        const rootPrefix = lang === '' ? '' : '../';

        let thumb = (item.image || item.thumbnail || 'https://www.koricare.kr/link/koricare_main_logo_nobg.png').replace(/&amp;/g, '&');
        if (thumb.startsWith('news/')) thumb = rootPrefix + thumb;
        
        let title = item.title_en || item.title;
        if (lang === 'th/' && item.title_th) title = item.title_th;
        if (lang === 'vi/' && item.title_vi) title = item.title_vi;
        if (!title) title = item.title_en || item.title || item.title_ko || '';
        
        let sourceName = 'News';
        try {
            const urlObj = new URL(item.link || item.url || 'https://news/');
            sourceName = urlObj.hostname.replace('www.', '');
            sourceName = sourceName.charAt(0).toUpperCase() + sourceName.slice(1).split('.')[0];
        } catch(e) {}
        
        const dateStr = item.date || '';
        
        const newsHref = rootPrefix + `news/${item.id}.html`;

        return `    <a href="${newsHref}" class="list-item-card" style="display:flex; flex-direction:row; padding:14px 0; border-bottom:1px solid var(--line); text-decoration:none; transition:all 0.2s ease; align-items:center;">
      <div class="list-thumb" style="width:96px; height:72px; flex-shrink:0; border-radius:12px; background:#f1f5f9; overflow:hidden; margin-right:14px;">
        <img src="${thumb}" alt="${title}" onerror="this.onerror=null;this.src='https://www.koricare.kr/link/koricare_main_logo_nobg.png';" style="width:100%; height:100%; object-fit:cover; display:block;">
      </div>
      <div style="display:flex; flex-direction:column; flex:1; justify-content:center;">
        <div class="list-title" style="font-size:16px; font-weight:700; color:var(--ink); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word;">${title}</div>
        <div style="font-size:13px; color:var(--sub); margin-top:6px; font-weight:500;">${sourceName} &middot; ${dateStr}</div>
      </div>
    </a>`;
      }).join('\n');

      const updated = content.slice(0, sIdx + startM.length) + '\n  <div class="news-list" id="news-list" style="display:flex; flex-direction:column; margin-bottom:28px;">\n' + cardsHtml + '\n  </div>\n  ' + content.slice(eIdx);
      fs.writeFileSync(langPath, updated, 'utf-8');
      console.log(`[Success] ${lang}index.html horizontal news cards synced!`);
    }
  });

  generateSitemap();
}

syncNewsIndex();
