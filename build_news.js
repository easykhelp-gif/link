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
    '    <loc>https://www.koricare.kr/link/severance-calculator</loc>',
    '    <changefreq>weekly</changefreq>',
    '    <priority>0.8</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.koricare.kr/link/th/severance-calculator</loc>',
    '    <changefreq>weekly</changefreq>',
    '    <priority>0.8</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.koricare.kr/link/vi/severance-calculator</loc>',
    '    <changefreq>weekly</changefreq>',
    '    <priority>0.8</priority>',
    '  </url>'
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

  if (!Array.isArray(dirUrls) || dirUrls.length < 216) {
    console.error('[Error] directory_sitemap.json has fewer than 216 entries. Fail-hard triggered.');
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

  xmlLines.push('</urlset>');

  fs.writeFileSync(SITEMAP_PATH, xmlLines.join('\n'), 'utf-8');
  console.log('[Success] sitemap.xml updated successfully without news items!');
}

function syncNewsIndex() {
  if (!fs.existsSync(NEWS_LIST_PATH)) return;
  const newsList = JSON.parse(fs.readFileSync(NEWS_LIST_PATH, 'utf-8'));
  const top3 = newsList.slice(0, 3);

  // English main index
  if (fs.existsSync(INDEX_PATH)) {
    let content = fs.readFileSync(INDEX_PATH, 'utf-8');
    const startM = '<!-- NEWS_START -->';
    const endM = '<!-- NEWS_END -->';
    const sIdx = content.indexOf(startM);
    const eIdx = content.indexOf(endM);

    if (sIdx !== -1 && eIdx !== -1) {
      const cardsHtml = top3.map(item => {
        const thumb = (item.image || item.thumbnail || 'https://www.koricare.kr/link/koricare_main_logo_nobg.png').replace(/&amp;/g, '&');
        const title = item.title_en || item.title || item.title_th || item.title_ko;
        return `    <a href="news/${item.id}.html" class="news-card" style="display:flex; flex-direction:column; background:#fff; border-radius:14px; text-decoration:none; border:1px solid #cbd5e1; box-shadow:0 3px 10px rgba(15,23,42,0.05); overflow:hidden; transition:all 0.2s ease;">
      <div style="width:100%; height:100px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; overflow:hidden;">
        <img src="${thumb}" alt="${title}" onerror="this.onerror=null;this.src='https://www.koricare.kr/link/koricare_main_logo_nobg.png';" style="width:100%; height:100%; object-fit:cover; display:block;">
      </div>
      <div style="padding:8px 10px; display:flex; flex-direction:column; flex:1; justify-content:center;">
        <div style="font-size:12px; font-weight:800; color:#002366; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word;">${title}</div>
      </div>
    </a>`;
      }).join('\n');

      const updated = content.slice(0, sIdx + startM.length) + '\n  <div class="news-grid" id="news-list" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:28px;">\n' + cardsHtml + '\n  </div>\n  ' + content.slice(eIdx);
      fs.writeFileSync(INDEX_PATH, updated, 'utf-8');
      console.log('[Success] index.html horizontal news cards synced!');
    }
  }

  generateSitemap();
}

syncNewsIndex();
