const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const NEWS_LIST_PATH = path.join(DATA_DIR, 'news_list.json');
const INDEX_PATH = path.join(BASE_DIR, 'index.html');
const SITEMAP_PATH = path.join(BASE_DIR, 'sitemap.xml');

function generateSitemap(newsList) {
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
    '  </url>'
  ];

  newsList.forEach(item => {
    xmlLines.push('  <url>');
    xmlLines.push(`    <loc>https://www.koricare.kr/link/news/${item.id}.html</loc>`);
    xmlLines.push(`    <lastmod>${item.date || '2026-07-16'}</lastmod>`);
    xmlLines.push('    <changefreq>monthly</changefreq>');
    xmlLines.push('    <priority>0.8</priority>');
    xmlLines.push('  </url>');
  });

  xmlLines.push('</urlset>');

  fs.writeFileSync(SITEMAP_PATH, xmlLines.join('\n'), 'utf-8');
  console.log('[Success] sitemap.xml updated successfully!');
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
        const thumb = item.thumbnail || 'news/images/news_thumb_visa.png';
        const title = item.title_en || item.title_th || item.title_ko;
        const dateStr = (item.date || 'JUL 16, 2026').toUpperCase();
        return `    <a href="news/${item.id}.html" class="news-card" style="display:flex; flex-direction:row; align-items:center; gap:14px; padding:12px 16px; background:#fff; border-radius:16px; text-decoration:none; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(15,23,42,0.03); transition:all 0.2s ease;">
      <img src="${thumb}" alt="${title}" style="width:72px; height:72px; object-fit:cover; border-radius:12px; flex-shrink:0;">
      <div style="flex:1; min-width:0;">
        <div style="font-size:11.5px; color:#2563eb; font-weight:800; margin-bottom:3px;">${dateStr}</div>
        <div style="font-size:14px; font-weight:800; color:#002366; line-height:1.35; word-break:break-word;">${title}</div>
      </div>
    </a>`;
      }).join('\n');

      const updated = content.slice(0, sIdx + startM.length) + '\n  <div class="news-grid" id="news-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom:24px;">\n' + cardsHtml + '\n  </div>\n  ' + content.slice(eIdx);
      fs.writeFileSync(INDEX_PATH, updated, 'utf-8');
      console.log('[Success] index.html horizontal news cards synced!');
    }
  }

  generateSitemap(newsList);
}

syncNewsIndex();
