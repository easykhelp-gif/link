const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const NEWS_LIST_PATH = path.join(DATA_DIR, 'news_list.json');
const INDEX_PATH = path.join(BASE_DIR, 'index.html');
const TH_INDEX_PATH = path.join(BASE_DIR, 'th', 'index.html');
const VI_INDEX_PATH = path.join(BASE_DIR, 'vi', 'index.html');
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
    '    <loc>https://www.koricare.kr/th/link</loc>',
    '    <changefreq>daily</changefreq>',
    '    <priority>0.9</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.koricare.kr/vi/link</loc>',
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

  // 1. English main index
  if (fs.existsSync(INDEX_PATH)) {
    let content = fs.readFileSync(INDEX_PATH, 'utf-8');
    const startM = '<!-- NEWS_START -->';
    const endM = '<!-- NEWS_END -->';
    const sIdx = content.indexOf(startM);
    const eIdx = content.indexOf(endM);

    if (sIdx !== -1 && eIdx !== -1) {
      const cards = top3.map(item => {
        const thumb = item.thumbnail || 'koricare_main_logo_nobg.png';
        const title = item.title_en || item.title_th || item.title_ko;
        return `    <a href="news/${item.id}.html" class="news-card">
      <img src="${thumb}" alt="${title}" class="news-thumb">
      <div class="news-title">${title}</div>
      <div class="news-link">Read Executive Summary ➔</div>
    </a>`;
      }).join('\n');

      const updated = content.slice(0, sIdx + startM.length) + '\n' + cards + '\n    ' + content.slice(eIdx);
      fs.writeFileSync(INDEX_PATH, updated, 'utf-8');
      console.log('[Success] index.html news cards synced!');
    }
  }

  generateSitemap(newsList);
}

syncNewsIndex();
