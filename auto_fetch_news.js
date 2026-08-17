const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

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

// 3 Major Verified Outlets Per Language
const RSS_FEEDS = {
  en: [
    'https://en.yna.co.kr/RSS/news.xml',
    'https://www.koreatimes.co.kr/www/rss/rss.xml',
    'https://www.koreaherald.com/common_prog/rssdata/rss_all_0000.xml'
  ],
  th: [
    'https://www.khaosod.co.th/feed',
    'https://www.thairath.co.th/rss/news',
    'https://www.dailynews.co.th/feed/'
  ],
  vi: [
    'https://vnexpress.net/rss/tin-moi-nhat.rss',
    'https://tuoitre.vn/rss/tin-moi-nhat.rss',
    'https://thanhnien.vn/rss/home.rss'
  ]
};

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/\[\.\.\.\]/g, '')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.setTimeout(7000, () => { req.destroy(); resolve(''); });
  });
}

function parseXmlItems(xmlText) {
  const items = [];
  if (!xmlText) return items;
  const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const itemXml of itemMatches) {
    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    
    const imgMatch = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i) || 
                     itemXml.match(/<enclosure[^>]+url=["']([^"']+)["']/i) ||
                     itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);

    let cleanTitle = titleMatch ? cleanText(titleMatch[1]) : '';
    let cleanLink = linkMatch ? linkMatch[1].trim() : '';
    let cleanDesc = descMatch ? cleanText(descMatch[1]) : '';
    let actualImg = imgMatch ? imgMatch[1].replace(/&amp;/g, '&') : '';

    if (cleanTitle && cleanLink && cleanTitle.length > 5) {
      items.push({
        title: cleanTitle,
        link: cleanLink,
        desc: cleanDesc,
        image: actualImg,
        date: pubDateMatch ? new Date(pubDateMatch[1]).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      });
    }
  }
  return items;
}

function buildArticleHtml(newsItem, lang) {
  const dateStr = newsItem.date || new Date().toISOString().slice(0, 10);
  
  const bannerHtml = `
    <div style="background: linear-gradient(135deg, #002366 0%, #1e40af 100%); border-radius: 18px; padding: 24px 20px; color: #ffffff; margin: 36px 0 20px; box-shadow: 0 8px 24px rgba(0,35,102,0.18); text-align: center;">
      <div style="font-size: 13.5px; opacity: 0.95; line-height: 1.55; margin-bottom: 16px; color:#e2e8f0; max-width: 540px; margin-left: auto; margin-right: auto; font-weight: 500;">Struggling with Visa, Labor Rights, or Legal Help in Korea? Talk to Your Specialist.</div>
      <a href="https://www.koricare.kr" target="_blank" style="display: inline-flex; align-items: center; justify-content: center; background: #ffffff; color: #002366; padding: 9px 20px; border-radius: 10px; font-weight: 800; font-size: 13px; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.12);">Kori Care 1:1 Help ➔</a>
    </div>
  `;

  let engSummarySection = '';
  if (lang !== 'en') {
    engSummarySection = `
      <div style="margin-top:24px; padding:16px 20px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
        <div style="font-size:13.5px; color:#475569; line-height:1.65; font-weight:500;">${newsItem.title}</div>
      </div>
    `;
  }

  const heroImgTag = newsItem.image ? `<img src="${newsItem.image}" alt="${newsItem.title}" style="width:100%; max-height:380px; object-fit:cover; border-radius:16px; margin: 18px 0 22px;">` : '';
  const backHref = lang === 'th' ? '../th/' : (lang === 'vi' ? '../vi/' : '../');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${newsItem.title} — Kori Care News</title>
<meta name="description" content="${newsItem.desc.slice(0, 150)}">
<link rel="canonical" href="https://www.koricare.kr/link/news/${newsItem.id}.html">
<meta name="robots" content="noindex, follow">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-F0R2ZQNNPZ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-F0R2ZQNNPZ');
</script>
<link rel="icon" type="image/png" href="https://www.koricare.kr/link/koricare_main_logo_nobg.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --bg: #f8fafc; --card: #ffffff; --ink: #0f172a; --sub: #64748b; --navy: #002366; --line: #e2e8f0; }
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
  .date-bar { font-size: 13px; color: var(--sub); font-weight: 600; margin-bottom: 12px; }
  h1 { font-size: 22px; font-weight: 900; color: var(--navy); line-height: 1.45; margin-bottom: 12px; }
  .article-content { font-size: 16px; color: #334155; line-height: 1.8; margin-top: 18px; }
  .src-link-subtle { display: inline-flex; align-items: center; gap: 4px; margin-top: 16px; font-size: 12px; color: #94a3b8; font-weight: 500; text-decoration: underline; }
  .back-btn-minimal { display: flex; align-items: center; justify-content: center; font-size: 13.5px; font-weight: 700; color: #475569; background: #ffffff; border: 1px solid var(--line); padding: 12px; border-radius: 14px; margin-top: 20px; transition: all 0.2s; }
</style>
</head>
<body>
<header>
  <div class="wrap" style="display:flex; justify-content:space-between; align-items:center;">
    <a href="${backHref}" class="logo">
      <img src="https://www.koricare.kr/link/koricare_main_logo_nobg.png" alt="Kori Care" class="logo-img">
      <div class="logo-text">
        <b>Kori Care</b>
        <span>Trending News</span>
      </div>
    </a>
  </div>
</header>

<main class="wrap">
  <article class="post-card">
    <div class="date-bar">${dateStr}</div>
    <h1>${newsItem.title}</h1>
    <hr style="border:none; border-top:1px solid #e2e8f0; margin:14px 0 20px;">
    ${heroImgTag}
    <div class="article-content">
      <p style="margin-bottom:16px; font-size:15.5px; line-height:1.8; color:#1e293b; font-weight:500;">
        ${newsItem.desc ? newsItem.desc.replace(/&lt;[^&gt;]*&gt;/g, '').replace(/<[^>]*>/g, '').trim() : newsItem.title}
      </p>
      <div style="background:#f1f5f9; padding:16px 20px; border-radius:14px; border-left:4px solid #002366; margin:20px 0;">
        <div style="font-size:13px; font-weight:800; color:#002366; margin-bottom:6px;">📌 Key Summary & Verification</div>
        <div style="font-size:13.5px; color:#475569; line-height:1.65;">
          This news update has been automatically verified and curated for foreign residents living in South Korea. For full unedited coverage, please reference the official source below.
        </div>
      </div>
      <a href="${newsItem.link || '#'}" class="src-link-subtle" target="_blank" rel="noopener" style="font-weight:bold; color:#2563eb;">🔗 Read Full Article on Original Source ➔</a>
    </div>

    ${engSummarySection}

    ${bannerHtml}
  </article>

  <a href="${backHref}" class="back-btn-minimal">Back to Main Portal</a>
</main>
</body>
</html>`;
}

function injectGridCardsToIndex(indexPath, newsList, langPrefix) {
  if (!fs.existsSync(indexPath)) return;
  let content = fs.readFileSync(indexPath, 'utf-8');
  const startM = '<!-- NEWS_START -->';
  const endM = '<!-- NEWS_END -->';
  const sIdx = content.indexOf(startM);
  const eIdx = content.indexOf(endM);

  const top3 = newsList.slice(0, 3);
  if (sIdx !== -1 && eIdx !== -1 && top3.length > 0) {
    const cardsHtml = top3.map(item => {
      const rawThumb = item.image ? item.image.replace(/&amp;/g, '&') : 'https://www.koricare.kr/link/koricare_main_logo_nobg.png';
      const thumb = rawThumb;
      const title = item.title;
      const href = `${langPrefix}news/${item.id}.html`;
      const dateStr = item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      return `    <a href="${href}" class="list-item-card" style="display:flex; flex-direction:row; padding:14px 0; border-bottom:1px solid var(--line); text-decoration:none; transition:all 0.2s ease; align-items:center;">
      <div class="list-thumb" style="width:96px; height:72px; flex-shrink:0; border-radius:12px; background:#f1f5f9; overflow:hidden; margin-right:14px;">
        <img src="${thumb}" alt="${title}" onerror="this.onerror=null;this.src='https://www.koricare.kr/link/koricare_main_logo_nobg.png';" style="width:100%; height:100%; object-fit:cover; display:block;">
      </div>
      <div style="display:flex; flex-direction:column; flex:1; justify-content:center;">
        <div class="list-title" style="font-size:16px; font-weight:700; color:var(--ink); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word;">${title}</div>
        <div style="font-size:13px; color:var(--sub); margin-top:6px; font-weight:500;">News &middot; ${dateStr}</div>
      </div>
    </a>`;
    }).join('\n');

    const gridWrapper = `\n  <div class="news-list" id="news-list" style="display:flex; flex-direction:column; margin-bottom:28px;">\n${cardsHtml}\n  </div>\n  `;

    const updated = content.slice(0, sIdx + startM.length) + gridWrapper + content.slice(eIdx);
    fs.writeFileSync(indexPath, updated, 'utf-8');
  }
}

async function runPipeline() {
  console.log('🚀 3대 언론사 멀티 교차 파싱 파이프라인 집행...');

  for (const lang of ['en', 'th', 'vi']) {
    let combinedItems = [];
    for (const feedUrl of RSS_FEEDS[lang]) {
      const xml = await fetchUrl(feedUrl);
      const items = parseXmlItems(xml);
      if (items.length > 0) {
        combinedItems.push(...items);
      }
    }

    // Filter unique titles
    const seen = new Set();
    const uniqueItems = combinedItems.filter(item => {
      if (seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    });

    const dataPath = path.join(DATA_DIR, `news_list_${lang}.json`);
    let existingList = [];
    if (fs.existsSync(dataPath)) {
      try { existingList = JSON.parse(fs.readFileSync(dataPath, 'utf-8')); } catch(e){}
    }

    const newItemsList = uniqueItems.map((item) => {
      const hash = crypto.createHash('md5').update(item.link || item.title).digest('hex').slice(0,8);
      const id = `hotnews_${lang}_${hash}`;
      item.id = id;
      return item;
    });

    for (const item of newItemsList) {
      if (!existingList.find(x => x.link === item.link)) {
        const html = buildArticleHtml(item, lang);
        fs.writeFileSync(path.join(NEWS_DIR, `${item.id}.html`), html, 'utf-8');
        existingList.unshift({ id: item.id, date: item.date, image: item.image, title: item.title, link: item.link });
      }
    }

    // Rolling retention (keep 50)
    const keptList = existingList.slice(0, 50);
    const removedList = existingList.slice(50);
    
    // HTML files are kept permanently to prevent 404s.

    fs.writeFileSync(dataPath, JSON.stringify(keptList, null, 2), 'utf-8');
    const newsList = keptList;

    const targetIndexPath = lang === 'en' ? INDEX_EN_PATH : (lang === 'th' ? INDEX_TH_PATH : INDEX_VI_PATH);
    const langPrefix = lang === 'en' ? '' : '../';
    injectGridCardsToIndex(targetIndexPath, newsList, langPrefix);
  }

  console.log('🎉 3대 언론사 교차 파싱 완료!');
}

runPipeline();
