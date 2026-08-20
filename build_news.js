const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
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
    '  </url>',
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

  if (!Array.isArray(dirUrls) || dirUrls.length === 0) {
    console.error('[Error] directory_sitemap.json is empty or not an array. Fail-hard triggered.');
    process.exit(1);
  }

  // 데이터 유실 방어. 고정 숫자(구 99) 대신 직전 sitemap.xml과 비교한다.
  // 고정 하한은 디렉토리를 정상적으로 하나만 정리해도 빌드를 죽인다.
  // 여기서 막으려는 것은 "정상적인 증감"이 아니라 "파일 파손으로 인한 급감"이다.
  const SHRINK_LIMIT = 0.8; // 직전 대비 80% 미만으로 줄면 중단
  if (fs.existsSync(SITEMAP_PATH)) {
    const prev = fs.readFileSync(SITEMAP_PATH, 'utf-8');
    // 디렉토리 URL만 센다: /link/{lang}/{도시}/{분류}/ 형태.
    // 고정 URL(/link/th/, /link/th/severance-calculator)과 가이드는 제외.
    const prevDirCount = (prev.match(/<loc>[^<]*\/link\/(?:en|th|vi)\/[^/<]+\/[^/<]+\/?<\/loc>/g) || [])
      .filter(l => !l.includes('/guides/')).length;
    if (prevDirCount > 0 && dirUrls.length < prevDirCount * SHRINK_LIMIT) {
      console.error(
        `[Error] directory_sitemap.json shrank sharply: ${prevDirCount} -> ${dirUrls.length}` +
        ` (limit ${Math.ceil(prevDirCount * SHRINK_LIMIT)}). Suspecting data corruption. Fail-hard triggered.`
      );
      console.error('        의도한 축소라면 sitemap.xml을 먼저 갱신하거나 SHRINK_LIMIT을 조정하세요.');
      process.exit(1);
    }
    if (prevDirCount > 0 && dirUrls.length !== prevDirCount) {
      console.log(`[Info] directory URLs: ${prevDirCount} -> ${dirUrls.length}`);
    }
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


// syncNewsIndex()는 제거했다.
// index.html의 뉴스 카드는 auto_fetch_news.js가 news_list_*.json으로 4시간마다 갱신한다.
// 이 파일이 보던 data/news_list.json은 2026-07-16에서 멈춘 낡은 데이터여서,
// 사이트맵만 갱신하려고 이 스크립트를 돌리면 3개 언어 홈페이지 뉴스가
// 한 달 전 기사로 덮어써지는 사고가 났다. 이 스크립트는 사이트맵 생성 전용이다.

generateSitemap();
