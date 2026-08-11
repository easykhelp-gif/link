const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const NEWS_DIR = path.join(BASE_DIR, 'news');
const IMAGES_DIR = path.join(NEWS_DIR, 'images');
const NEWS_LIST_PATH = path.join(DATA_DIR, 'news_list.json');
const INDEX_PATH = path.join(BASE_DIR, 'index.html');
const TH_INDEX_PATH = path.join(BASE_DIR, 'th', 'index.html');
const VI_INDEX_PATH = path.join(BASE_DIR, 'vi', 'index.html');
const SITEMAP_PATH = path.join(BASE_DIR, 'sitemap.xml');

for (const d of [DATA_DIR, NEWS_DIR, IMAGES_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// 1. RSS Feeds for Trending Issues (No Keyword Restriction)
const RSS_FEEDS = {
  th: [
    'https://www.khaosod.co.th/feed',
    'https://www.sanook.com/news/archive/rss/',
    'https://www.thairath.co.th/rss/news'
  ],
  vi: [
    'https://vnexpress.net/rss/tin-moi-nhat.rss',
    'https://tuoitre.vn/rss/tin-moi-nhat.rss'
  ],
  en: [
    'https://www.koreatimes.co.kr/www/rss/rss.xml'
  ]
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', err => reject(err));
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseXmlItems(xmlText) {
  const items = [];
  const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const itemXml of itemMatches) {
    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

    let cleanTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    let cleanLink = linkMatch ? linkMatch[1].trim() : '';
    let cleanDesc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    if (cleanTitle && cleanLink) {
      items.push({
        title: cleanTitle,
        link: cleanLink,
        desc: cleanDesc.slice(0, 300),
        date: pubDateMatch ? new Date(pubDateMatch[1]).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      });
    }
  }
  return items;
}

function buildArticleHtml(newsItem, lang) {
  const dateStr = newsItem.date || new Date().toISOString().slice(0, 10);
  const bannerHtml = `
    <div style="background: linear-gradient(135deg, #002366 0%, #1e40af 100%); border-radius: 18px; padding: 22px; color: #ffffff; margin: 32px 0 20px; box-shadow: 0 8px 24px rgba(0,35,102,0.2); border: 1px solid rgba(255,255,255,0.15);">
      <div style="font-size: 18px; font-weight: 800; margin-bottom: 6px; color:#ffffff;">Kori Care 1:1 Specialist Support</div>
      <div style="font-size: 13px; opacity: 0.92; line-height: 1.5; margin-bottom: 16px; color:#e2e8f0;">Struggling with Visa, Labor Rights, or Legal Help in Korea? Talk to Your Specialist.</div>
      <a href="https://www.koricare.kr" target="_blank" style="display: inline-block; background: #ffffff; color: #002366; padding: 12px 22px; border-radius: 12px; font-weight: 800; font-size: 14px; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">Get 1:1 Help ➔</a>
    </div>
  `;

  let engSummarySection = '';
  if (lang !== 'en') {
    engSummarySection = `
      <div style="margin-top:24px; padding:18px; background:#eff6ff; border-radius:14px; border:1px solid #bfdbfe;">
        <div style="font-size:13.5px; font-weight:800; color:#1e40af; margin-bottom:6px;">🌐 Executive English Summary</div>
        <div style="font-size:14px; color:#1e3a8a; line-height:1.6;">${newsItem.title} - Key trending updates and core highlights from local media coverage.</div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${newsItem.title} — Kori Care News</title>
<meta name="description" content="${newsItem.desc.slice(0, 150)}">
<link rel="canonical" href="https://www.koricare.kr/link/news/${newsItem.id}.html">
<link rel="icon" type="image/png" href="https://www.koricare.kr/link/koricare_main_logo_nobg.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --bg: #f8fafc; --card: #ffffff; --ink: #0f172a; --sub: #475569; --navy: #002366; --line: #e2e8f0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--ink); font-family: "Inter", "Noto Sans Thai", system-ui, sans-serif; font-size: 16px; line-height: 1.75; padding-bottom: 48px; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 0 16px; }
  a { text-decoration: none; color: inherit; }
  header { background: var(--navy); color: #fff; padding: 12px 0; box-shadow: 0 4px 20px rgba(0,35,102,0.15); }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-img { width: 34px; height: 34px; object-fit: contain; }
  .logo-text b { font-size: 18px; font-weight: 900; }
  .logo-text span { font-size: 9.5px; opacity: 0.85; text-transform: uppercase; font-weight: 700; }
  .post-card { background: var(--card); border: 1px solid var(--line); border-radius: 24px; padding: 28px; margin-top: 24px; box-shadow: 0 10px 30px rgba(15,23,42,0.06); }
  .tag-bar { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--sub); font-weight: 700; margin-bottom: 14px; }
  .tag { background: #e0e7ff; color: #1e40af; padding: 3px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 800; }
  h1 { font-size: 23px; font-weight: 900; color: var(--navy); line-height: 1.4; margin-bottom: 16px; }
  .article-content { font-size: 16px; color: #334155; line-height: 1.8; margin-top: 16px; }
  .src-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 20px; font-size: 13.5px; font-weight: 700; color: #2563eb; text-decoration: underline; }
  .back-btn { display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; color: var(--navy); background: #ffffff; border: 1.5px solid var(--line); padding: 14px; border-radius: 16px; margin-top: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
</style>
</head>
<body>
<header>
  <div class="wrap" style="display:flex; justify-content:space-between; align-items:center;">
    <a href="../index.html" class="logo">
      <img src="../koricare_main_logo_nobg.png" alt="Kori Care" class="logo-img">
      <div class="logo-text">
        <b>Kori Care</b>
        <span>Trending News & Policy</span>
      </div>
    </a>
  </div>
</header>

<main class="wrap">
  <article class="post-card">
    <div class="tag-bar">
      <span class="tag">🔥 Hot Issue</span>
      <span>📅 ${dateStr}</span>
    </div>
    <h1>${newsItem.title}</h1>
    <hr style="border:none; border-top:1px solid #e2e8f0; margin:16px 0;">
    <div class="article-content">
      <p style="margin-bottom:16px;">${newsItem.desc || newsItem.title}</p>
      <p style="margin-bottom:16px;">Full coverage and detailed reporting provided by accredited news sources. Stay informed with Kori Care's verified multi-language portal updates.</p>
    </div>

    ${engSummarySection}

    <a href="${newsItem.link}" class="src-link" target="_blank" rel="noopener">🔗 Reference Original Source ➔</a>

    ${bannerHtml}
  </article>

  <a href="../index.html" class="back-btn">⬅️ Back to Main Portal</a>
</main>
</body>
</html>`;
}

async function runAutoPipeline() {
  console.log('🚀 1시간 주기 실시간 핫이슈 무인 자동 크롤링 시작...');

  const existingList = fs.existsSync(NEWS_LIST_PATH) ? JSON.parse(fs.readFileSync(NEWS_LIST_PATH, 'utf-8')) : [];

  // Scrape Thai Trending News
  try {
    const xmlTh = await fetchUrl(RSS_FEEDS.th[0]);
    const itemsTh = parseXmlItems(xmlTh);
    if (itemsTh.length > 0) {
      const topTh = itemsTh[0];
      const newId = `hotnews_th_${Date.now()}`;
      topTh.id = newId;
      topTh.thumbnail = 'news/images/news_thumb_visa.png';

      const html = buildArticleHtml(topTh, 'th');
      fs.writeFileSync(path.join(NEWS_DIR, `${newId}.html`), html, 'utf-8');

      existingList.unshift({
        id: newId,
        date: topTh.date,
        thumbnail: topTh.thumbnail,
        title_th: topTh.title,
        title_en: topTh.title,
        url: topTh.link
      });
    }
  } catch (err) {
    console.warn('Thai RSS fetch skipped:', err.message);
  }

  // Keep top 10 items
  const finalList = existingList.slice(0, 10);
  fs.writeFileSync(NEWS_LIST_PATH, JSON.stringify(finalList, null, 2), 'utf-8');

  // Update Horizontal Row Grid Cards on index.html
  const top3 = finalList.slice(0, 3);
  if (fs.existsSync(INDEX_PATH)) {
    let content = fs.readFileSync(INDEX_PATH, 'utf-8');
    const startM = '<!-- NEWS_START -->';
    const endM = '<!-- NEWS_END -->';
    const sIdx = content.indexOf(startM);
    const eIdx = content.indexOf(endM);

    if (sIdx !== -1 && eIdx !== -1) {
      const cardsHtml = top3.map(item => {
        const thumb = item.thumbnail || 'news/images/news_thumb_visa.png';
        const title = item.title_en || item.title_th || item.title_ko || item.title;
        const dateStr = (item.date || 'TODAY').toUpperCase();
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
      console.log('[Success] 메인 포털 인덱스 실시간 뉴스 주입 완료!');
    }
  }

  console.log('🎉 1시간 주기 실시간 뉴스 무인 크롤링 & 동기화 완료!');
}

runAutoPipeline();
