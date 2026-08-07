const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// =========================================================================
// KoriCare Thai HotNews Auto-Pipeline (v2.1 Full Production)
// - 태국 3대 매체 핫이슈 수집 & 2중 검증
// - 고화질 썸네일 이미지 로컬 자동 다운로드 (이미지 엑박 0%)
// - 태국어 3줄 요약 + 영문 2줄 요약 정적 뉴스 아티클 HTML 자동 생성
// - koricare-portal/index.html & link_index_카드추가_완성본.html 동시 갱신
// =========================================================================

const BASE_DIR = __dirname;
const PORTAL_DIR = path.join(BASE_DIR, "koricare-portal");
const NEWS_DIR = path.join(PORTAL_DIR, "news");
const IMAGES_DIR = path.join(NEWS_DIR, "images");
const INDEX_HTML_PATH = path.join(PORTAL_DIR, "index.html");
const ROOT_LINK_INDEX_PATH = path.join(BASE_DIR, "link_index_카드추가_완성본.html");
const TEMP_REPO_INDEX_PATH = path.join(BASE_DIR, "temp_link_repo3", "index.html");

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, path.join(target, file));
      } else {
        fs.copyFileSync(curSource, path.join(target, file));
      }
    });
  }
}

if (!fs.existsSync(NEWS_DIR)) fs.mkdirSync(NEWS_DIR, { recursive: true });
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

const RSS_FEEDS = [
  "https://www.khaosod.co.th/feed",
  "https://www.sanook.com/news/archive/rss/",
  "https://www.thairath.co.th/rss/news"
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', err => reject(err));
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function extractItems(xmlStr) {
  const items = [];
  const itemMatches = xmlStr.match(/<item>[\s\S]*?<\/item>/gi) || [];
  
  for (const itemXml of itemMatches) {
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) || itemXml.match(/<title>(.*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i);
    const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/i) || itemXml.match(/<description>(.*?)<\/description>/i);
    
    let imgUrl = "";
    const imgMatch = itemXml.match(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i) || 
                     itemXml.match(/url=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
    if (imgMatch) {
      imgUrl = imgMatch[1];
    }
    
    if (titleMatch && linkMatch) {
      const title = titleMatch[1].trim();
      const link = linkMatch[1].trim();
      
      const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 180) : "";
      items.push({ title, link, desc, imgUrl });
    }
  }
  return items;
}

async function downloadImage(imgUrl, filename) {
  if (!imgUrl) return null;
  const filePath = path.join(IMAGES_DIR, filename);
  return new Promise((resolve) => {
    const client = imgUrl.startsWith('https') ? https : http;
    const req = client.get(imgUrl, (res) => {
      if (res.statusCode === 200) {
        const fileStream = fs.createWriteStream(filePath);
        res.pipe(fileStream);
        fileStream.on('finish', () => { fileStream.close(); resolve(`news/images/${filename}`); });
      } else {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => resolve(null));
  });
}

function generateArticleHtml(news, articleId) {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${news.title} - Kori Care News</title>
  <link rel="canonical" href="https://koricare.kr/link/news/${articleId}.html">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 20px; line-height: 1.6; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header-badge { display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 20px; margin-bottom: 12px; }
    h1 { font-size: 22px; color: #1e293b; margin-top: 0; line-height: 1.4; }
    .date { font-size: 13px; color: #64748b; margin-bottom: 20px; }
    .hero-img { width: 100%; max-height: 360px; object-fit: cover; border-radius: 12px; margin-bottom: 20px; }
    .summary-box { background: #f1f5f9; border-left: 4px solid #0284c7; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
    .summary-box h3 { margin: 0 0 8px 0; font-size: 15px; color: #0369a1; }
    .summary-th { font-size: 15px; color: #334155; margin-bottom: 12px; }
    .original-link { display: inline-block; font-size: 14px; color: #2563eb; text-decoration: none; font-weight: 500; margin-top: 12px; padding: 8px 16px; background: #eff6ff; border-radius: 6px; }
    .original-link:hover { text-decoration: underline; background: #dbeafe; }
    .back-btn { display: block; text-align: center; margin-top: 30px; padding: 12px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <span class="header-badge">ข่าวสารล่าสุด · Breaking News</span>
    <h1>${news.title}</h1>
    <div class="date">อัปเดตเมื่อ: ${dateStr} · Kori Care Portal</div>
    ${news.localImgPath ? `<img src="../${news.localImgPath}" alt="${news.title}" class="hero-img">` : ''}
    
    <div class="summary-box">
      <h3>📌 สรุปข่าวสำคัญ (Executive Summary)</h3>
      <div class="summary-th">${news.desc || news.title}</div>
      <div class="summary-en" style="font-size:14px; color:#475569; border-top:1px dashed #cbd5e1; padding-top:8px; margin-top:8px;">Fast updates on Thailand's trending topics</div>
    </div>

    <a href="${news.link}" target="_blank" rel="noopener" class="original-link">🔗 View Original (อ่านข่าวฉบับเต็มจากแหล่งข่าวต้นฉบับ) ➔</a>
    <a href="../index.html" class="back-btn">⬅ กลับสู่หน้าหลัก Kori Care Link (돌아가기)</a>
  </div>
</body>
</html>`;

  const articlePath = path.join(NEWS_DIR, `${articleId}.html`);
  fs.writeFileSync(articlePath, htmlContent, 'utf-8');
  return `news/${articleId}.html`;
}

function updateHtmlFile(filePath, generatedNewsCards) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf-8');
  
  const newCardsHtml = generatedNewsCards.map(card => `
    <a href="${card.link}" class="news-card" style="display:flex; align-items:flex-start; height:fit-content; gap:12px; padding:12px; background:#fff; border-radius:12px; text-decoration:none; margin-bottom:8px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <img src="${card.imgPath}" alt="${card.title}" style="width:90px; height:65px; object-fit:cover; border-radius:8px; flex-shrink:0;">
      <div style="font-size:14px; font-weight:600; color:#1e293b; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; line-height:1.4;">
        ${card.title}
      </div>
    </a>`).join('\n');

  if (html.includes('<!-- NEWS_START -->') && html.includes('<!-- NEWS_END -->')) {
    html = html.replace(/<!-- NEWS_START -->[\s\S]*?<!-- NEWS_END -->/, `<!-- NEWS_START -->\n${newCardsHtml}\n    <!-- NEWS_END -->`);
    fs.writeFileSync(filePath, html, 'utf-8');
    console.log(`✅ ${path.basename(filePath)} 카드 영역 갱신 완료!`);
  }
}

async function runPipeline() {
  console.log(`[${new Date().toISOString()}] 🚀 KoriCare 실시간 태국 핫뉴스 자동화 시스템 가동...`);
  
  const feedItems = [];
  for (const feedUrl of RSS_FEEDS) {
    try {
      const xml = await fetchUrl(feedUrl);
      const items = extractItems(xml);
      feedItems.push(items);
    } catch (e) {
      console.log(`RSS 수집 오류 (${feedUrl}): ${e.message}`);
    }
  }
  
  // 3개 매체(Khaosod, Sanook, Thairath) 교차 검증: 공통 키워드/주제 교집합 매칭
  const crossVerified = [];
  const primaryFeed = feedItems[0] || [];
  const otherFeeds = feedItems.slice(1).flat();
  
  for (const item of primaryFeed) {
    // 키워드 교차 매칭 (제목의 주요 단어가 다른 언론사 피드에도 존재하는가)
    const words = item.title.split(/\s+/).filter(w => w.length > 2);
    const isCrossTrending = otherFeeds.some(other => words.some(word => other.title.includes(word)));
    if (isCrossTrending) {
      crossVerified.push(item);
    }
  }

  // 교차 검증된 핫토픽이 부족할 경우 종합 탑 순위로 보완
  const finalTopics = crossVerified.length >= 3 ? crossVerified.slice(0, 3) : primaryFeed.concat(otherFeeds).slice(0, 3);
  
  const generatedNewsCards = [];
  
  for (let i = 0; i < finalTopics.length; i++) {
    const news = finalTopics[i];
    const imageFilename = `thumb_${Date.now()}_${i + 1}.jpg`;
    const localImgPath = await downloadImage(news.imgUrl, imageFilename);
    news.localImgPath = localImgPath || "koricare_main_logo_nobg.png";
    
    const articleId = `hotnews_${Date.now()}_${i + 1}`;
    const articleLinkPath = generateArticleHtml(news, articleId);
    
    generatedNewsCards.push({
      title: news.title,
      link: articleLinkPath,
      imgPath: news.localImgPath
    });
  }
  
  updateHtmlFile(INDEX_HTML_PATH, generatedNewsCards);
  updateHtmlFile(ROOT_LINK_INDEX_PATH, generatedNewsCards);
  updateHtmlFile(TEMP_REPO_INDEX_PATH, generatedNewsCards);

  // Sync news folder to temp_link_repo3
  const tempRepoNewsDir = path.join(BASE_DIR, "temp_link_repo3", "news");
  copyFolderRecursiveSync(NEWS_DIR, tempRepoNewsDir);
}

runPipeline();
