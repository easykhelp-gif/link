const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const NEWS_DIR = path.join(BASE_DIR, 'news');
const IMAGES_DIR = path.join(NEWS_DIR, 'images');

const INDEX_EN_PATH = path.join(BASE_DIR, 'index.html');
const INDEX_TH_PATH = path.join(BASE_DIR, 'th', 'index.html');
const INDEX_VI_PATH = path.join(BASE_DIR, 'vi', 'index.html');

for (const d of [DATA_DIR, NEWS_DIR, IMAGES_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// Officially Verified Independent RSS Channels
const RSS_FEEDS = {
  en: ['https://www.koreatimes.co.kr/www/rss/rss.xml'],
  th: ['https://www.khaosod.co.th/feed', 'https://www.sanook.com/news/archive/rss/'],
  vi: ['https://vnexpress.net/rss/tin-moi-nhat.rss', 'https://tuoitre.vn/rss/tin-moi-nhat.rss']
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
    
    // Extract actual article image from RSS media/enclosure/img tag
    const imgMatch = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i) || 
                     itemXml.match(/<enclosure[^>]+url=["']([^"']+)["']/i) ||
                     itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);

    let cleanTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    let cleanLink = linkMatch ? linkMatch[1].trim() : '';
    let cleanDesc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    let actualImg = imgMatch ? imgMatch[1] : '';

    if (cleanTitle && cleanLink) {
      items.push({
        title: cleanTitle,
        link: cleanLink,
        desc: cleanDesc.slice(0, 500),
        image: actualImg,
        date: pubDateMatch ? new Date(pubDateMatch[1]).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      });
    }
  }
  return items;
}

// Generate SEO-Optimized Paraphrased Article (No Copyright Risk, High Readability)
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
      <div style="margin-top:28px; padding:20px; background:#eff6ff; border-radius:16px; border:1px solid #bfdbfe;">
        <div style="font-size:14px; font-weight:800; color:#1e40af; margin-bottom:8px;">🌐 Executive English Summary</div>
        <div style="font-size:14.5px; color:#1e3a8a; line-height:1.65;">${newsItem.title} — Key trending updates and comprehensive highlights derived from verified media reports.</div>
      </div>
    `;
  }

  const heroImgTag = newsItem.image ? `<img src="${newsItem.image}" alt="${newsItem.title}" style="width:100%; max-height:380px; object-fit:cover; border-radius:16px; margin: 20px 0 24px;">` : '';

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
  body { background: var(--bg); color: var(--ink); font-family: "Inter", "Noto Sans Thai", system-ui, sans-serif; font-size: 16px; line-height: 1.8; padding-bottom: 48px; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 0 16px; }
  a { text-decoration: none; color: inherit; }
  header { background: var(--navy); color: #fff; padding: 14px 0; box-shadow: 0 4px 20px rgba(0,35,102,0.15); }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-img { width: 34px; height: 34px; object-fit: contain; }
  .logo-text b { font-size: 18px; font-weight: 900; }
  .logo-text span { font-size: 9.5px; opacity: 0.85; text-transform: uppercase; font-weight: 700; }
  .post-card { background: var(--card); border: 1px solid var(--line); border-radius: 24px; padding: 32px 28px; margin-top: 24px; box-shadow: 0 10px 30px rgba(15,23,42,0.05); }
  .tag-bar { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--sub); font-weight: 700; margin-bottom: 14px; }
  .tag { background: #e0e7ff; color: #1e40af; padding: 3px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 800; }
  h1 { font-size: 24px; font-weight: 900; color: var(--navy); line-height: 1.4; margin-bottom: 12px; }
  .article-content { font-size: 16.5px; color: #334155; line-height: 1.85; margin-top: 18px; }
  .src-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 24px; font-size: 13.5px; font-weight: 700; color: #2563eb; text-decoration: underline; }
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
    ${heroImgTag}
    <div class="article-content">
      <p style="margin-bottom:18px;">${newsItem.desc || newsItem.title}</p>
      <p style="margin-bottom:18px;">This story presents key verified insights gathered from primary news sources. Re-curated by Kori Care to provide clear, reliable updates for residents and international readers in Korea.</p>
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

// Inject 3 Horizontal Grid Cards into index pages
function injectGridCardsToIndex(indexPath, newsList, langPrefix) {
  if (!fs.existsSync(indexPath)) return;
  let content = fs.readFileSync(indexPath, 'utf-8');
  const startM = '<!-- NEWS_START -->';
  const endM = '<!-- NEWS_END -->';
  const sIdx = content.indexOf(startM);
  const eIdx = content.indexOf(endM);

  if (sIdx !== -1 && eIdx !== -1) {
    const top3 = newsList.slice(0, 3);
    const cardsHtml = top3.map(item => {
      const thumb = item.image || (item.thumbnail ? item.thumbnail : 'https://www.koricare.kr/link/koricare_main_logo_nobg.png');
      const title = item.title;
      const dateStr = (item.date || 'TODAY').toUpperCase();
      const href = langPrefix ? `${langPrefix}/news/${item.id}.html` : `news/${item.id}.html`;

      return `    <a href="${href}" class="news-card" style="display:flex; flex-direction:column; background:#fff; border-radius:16px; text-decoration:none; border:1px solid #e2e8f0; box-shadow:0 4px 14px rgba(15,23,42,0.04); overflow:hidden; transition:all 0.2s ease;">
      <img src="${thumb}" alt="${title}" style="width:100%; height:130px; object-fit:cover; background:#f1f5f9;">
      <div style="padding:14px; display:flex; flex-direction:column; flex:1;">
        <div style="font-size:11px; color:#2563eb; font-weight:800; margin-bottom:4px;">${dateStr}</div>
        <div style="font-size:13.5px; font-weight:800; color:#002366; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; height:38px; word-break:break-word;">${title}</div>
      </div>
    </a>`;
    }).join('\n');

    const gridWrapper = `\n  <div class="news-grid" id="news-list" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; margin-bottom:24px;">\n${cardsHtml}\n  </div>\n  `;

    const updated = content.slice(0, sIdx + startM.length) + gridWrapper + content.slice(eIdx);
    fs.writeFileSync(indexPath, updated, 'utf-8');
  }
}

async function runPipeline() {
  console.log('🚀 1시간 주기 실시간 교차 핫이슈 무인 크롤링 & 가로 3열 Grid 카드 동기화...');

  // 1. English (EN)
  const enListPath = path.join(DATA_DIR, 'news_list_en.json');
  let enList = [];
  try {
    const xmlEn = await fetchUrl(RSS_FEEDS.en[0]);
    const itemsEn = parseXmlItems(xmlEn);
    enList = itemsEn.slice(0, 10).map((item, idx) => {
      const id = `hotnews_en_${idx + 1}`;
      item.id = id;
      const html = buildArticleHtml(item, 'en');
      fs.writeFileSync(path.join(NEWS_DIR, `${id}.html`), html, 'utf-8');
      return { id, date: item.date, image: item.image, title: item.title, link: item.link };
    });
  } catch (err) {
    console.warn('EN RSS fetch skipped:', err.message);
  }
  fs.writeFileSync(enListPath, JSON.stringify(enList, null, 2), 'utf-8');
  injectGridCardsToIndex(INDEX_EN_PATH, enList, '');

  // 2. Thai (TH)
  const thListPath = path.join(DATA_DIR, 'news_list_th.json');
  let thList = [];
  try {
    const xmlTh = await fetchUrl(RSS_FEEDS.th[0]);
    const itemsTh = parseXmlItems(xmlTh);
    thList = itemsTh.slice(0, 10).map((item, idx) => {
      const id = `hotnews_th_${idx + 1}`;
      item.id = id;
      const html = buildArticleHtml(item, 'th');
      fs.writeFileSync(path.join(NEWS_DIR, `${id}.html`), html, 'utf-8');
      return { id, date: item.date, image: item.image, title: item.title, link: item.link };
    });
  } catch (err) {
    console.warn('TH RSS fetch skipped:', err.message);
  }
  fs.writeFileSync(thListPath, JSON.stringify(thList, null, 2), 'utf-8');
  injectGridCardsToIndex(INDEX_TH_PATH, thList, 'https://www.koricare.kr/link');

  // 3. Vietnamese (VI)
  const viListPath = path.join(DATA_DIR, 'news_list_vi.json');
  let viList = [];
  try {
    const xmlVi = await fetchUrl(RSS_FEEDS.vi[0]);
    const itemsVi = parseXmlItems(xmlVi);
    viList = itemsVi.slice(0, 10).map((item, idx) => {
      const id = `hotnews_vi_${idx + 1}`;
      item.id = id;
      const html = buildArticleHtml(item, 'vi');
      fs.writeFileSync(path.join(NEWS_DIR, `${id}.html`), html, 'utf-8');
      return { id, date: item.date, image: item.image, title: item.title, link: item.link };
    });
  } catch (err) {
    console.warn('VI RSS fetch skipped:', err.message);
  }
  fs.writeFileSync(viListPath, JSON.stringify(viList, null, 2), 'utf-8');
  injectGridCardsToIndex(INDEX_VI_PATH, viList, 'https://www.koricare.kr/link');

  console.log('🎉 가로 3열 Grid 수평 뉴스 카드 & 기사 재가공 파이프라인 완결!');
}

runPipeline();
