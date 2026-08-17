const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, "data");
const NEWS_DIR = path.join(BASE_DIR, "news");
const TEMPLATE_PATH = path.join(BASE_DIR, "templates", "news_template.html");
const INDEX_PATH = path.join(BASE_DIR, "th", "index.html");
const NEWS_LIST_PATH = path.join(DATA_DIR, "news_list.json");

// Ensure directories exist
[DATA_DIR, NEWS_DIR].forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

function loadEnv() {
  const envPath = path.join(BASE_DIR, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const parts = trimmed.split('=');
        const key = parts[0].trim();
        let val = parts.slice(1).join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
}

function makeRequest(url, method = 'GET', headers = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(data); });
    });

    req.on('error', (e) => { reject(e); });
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function parseRss(xmlText) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];
    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);
    
    // Extract Image URL from RSS content (enclosure, media content, or img tags)
    let imageUrl = '';
    const enclosureMatch = itemContent.match(/<enclosure[^>]*url=["']([^"']*)["']/i);
    const mediaMatch = itemContent.match(/<media:content[^>]*url=["']([^"']*)["']/i);
    const imgMatch = itemContent.match(/<img[^>]*src=["']([^"']*)["']/i);
    
    if (enclosureMatch) {
      imageUrl = enclosureMatch[1];
    } else if (mediaMatch) {
      imageUrl = mediaMatch[1];
    } else if (imgMatch) {
      imageUrl = imgMatch[1];
    }
    
    const clean = (str) => {
      if (!str) return '';
      return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim();
    };

    items.push({
      title: clean(titleMatch ? titleMatch[1] : ''),
      link: clean(linkMatch ? linkMatch[1] : ''),
      description: clean(descMatch ? descMatch[1] : ''),
      image: clean(imageUrl)
    });
  }
  return items;
}

async function callGeminiApi(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  const headers = {
    'Content-Type': 'application/json'
  };
  const data = JSON.stringify({
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  try {
    const responseText = await makeRequest(url, 'POST', headers, data);
    const parsed = JSON.parse(responseText);
    const resultText = parsed.candidates[0].content.parts[0].text;
    return JSON.parse(resultText.trim());
  } catch (e) {
    console.error('[Error] Gemini API 호출 실패:', e.message);
    return null;
  }
}

async function processPostWithAi(postText, hasKorean, apiKey) {
  let prompt = '';
  if (hasKorean) {
    console.log('[Info] 한국어가 감지되어 태국어 번역 및 HTML 포맷팅을 진행합니다...');
    prompt = `You are a professional translator translating Korean government/immigration news for Thai nationals living in South Korea.
Translate the following raw text containing Korean into natural, legally accurate Thai.

Glossary:
- 비자 연장 -> ต่ออายุวีซ่า
- 불법 체류 -> พำนักอย่างผิดกฎหมาย
- 자진 출국 -> รายงานตัวกลับประเทศโดยสมัครใจ
- 종합안내센터 -> ศูนย์บริการข้อมูลสำหรับชาวต่างชาติ
- 하이코리아 -> HiKorea (ไฮ코เรีย)
- 체류 자격 -> สถานะการพำนัก
- 출입국관리사무소 -> สำนักงานตรวจคนเข้าเมือง
- 범칙금 -> ค่าปรับ

Output MUST be a raw JSON object with exactly two keys:
1. "title_th": A search-optimized Thai title.
2. "content_th": The translated content in Thai, formatted with simple HTML tags (like <p>, <strong>, <ul>, <li>). Do NOT use markdown.

Raw Text to Translate:
${postText}

Output raw JSON:`;
  } else {
    console.log('[Info] 태국어로 구성된 글이 감지되어 기사식 구조 및 HTML 포맷팅을 진행합니다...');
    prompt = `You are an editor for Kori Care, a web portal for Thai expats in South Korea.
Take the following raw social media post in Thai, and refine it into a clean, professional news article format.
Create a search-engine optimized title, and format the body content with clean HTML tags (like <p>, <strong>, <ul>, <li>).

Output MUST be a raw JSON object with exactly two keys:
1. "title_th": A clean, catchy Thai title (SEO optimized).
2. "content_th": The formatted body content in Thai, structured with simple HTML tags.

Raw Thai Post:
${postText}

Output raw JSON:`;
  }

  return callGeminiApi(prompt, apiKey);
}

.html</loc>`);
    xmlLines.push(`    <lastmod>${item.date}</lastmod>`);
    xmlLines.push('    <changefreq>monthly</changefreq>');
    xmlLines.push('    <priority>0.8</priority>');
    xmlLines.push('  </url>');
  });
  xmlLines.push('</urlset>');
  fs.writeFileSync(sitemapPath, xmlLines.join('\n'), 'utf-8');
}

async function main() {
  console.log("==================================================");
  console.log(" 🚀 Kori Care - 페이스북 RSS 연동 자동 뉴스 빌더 (Node.js)");
  console.log("==================================================");

  loadEnv();
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  const rssUrl = process.env.FB_RSS_URL;

  if (!apiKey) {
    console.error("[Error] .env 파일에 GEMINI_API_KEY 또는 OPENAI_API_KEY가 필요합니다.");
    return;
  }
  if (!rssUrl || rssUrl.includes("your_facebook_rss")) {
    console.error("[Error] .env 파일에 올바른 FB_RSS_URL (페이스북 RSS 피드 주소)가 설정되어 있지 않습니다.");
    return;
  }

  // Load existing news
  let existingNews = [];
  if (fs.existsSync(NEWS_LIST_PATH)) {
    try {
      existingNews = JSON.parse(fs.readFileSync(NEWS_LIST_PATH, 'utf-8'));
    } catch (e) {
      existingNews = [];
    }
  }

  console.log(`[Info] 페이스북 RSS 피드를 가져오는 중: ${rssUrl}`);
  let xmlData = '';
  try {
    xmlData = await makeRequest(rssUrl, 'GET', { 'User-Agent': 'Mozilla/5.0' });
  } catch (e) {
    console.error(`[Error] RSS 피드 로드 실패: ${e.message}`);
    return;
  }

  const items = parseRss(xmlData);
  console.log(`[Info] 피드에서 ${items.length}개의 포스트를 발견했습니다.`);

  let newPostsProcessed = 0;

  // Process oldest to newest
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const sourceUrl = item.link;

    const alreadyExists = existingNews.some(news => news.url === sourceUrl);
    if (alreadyExists) continue;

    console.log(`\n🆕 새 포스트 발견! 링크: ${sourceUrl}`);
    const rawText = item.description;
    if (!rawText) continue;

    // Clean text
    const cleanText = rawText.replace(/<[^>]+>/g, '').trim();
    const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(cleanText);

    // Call AI
    const aiRes = await processPostWithAi(cleanText, hasKorean, apiKey);
    if (!aiRes) {
      console.warn("[Warning] AI 처리 실패로 이 포스트는 건너뜁니다.");
      continue;
    }

    const titleTh = (aiRes.title_th || '').trim();
    const contentTh = (aiRes.content_th || '').trim();

    if (!titleTh || !contentTh) continue;

    // Generate ID
    const todayStr = new Date().toISOString().split('T')[0];
    const dateIdPrefix = todayStr.replace(/-/g, '');
    
    let serial = 1;
    let newsId = '';
    while (true) {
      const candidateId = `${dateIdPrefix}_${String(serial).padStart(2, '0')}`;
      if (!fs.existsSync(path.join(NEWS_DIR, `${candidateId}.html`))) {
        newsId = candidateId;
        break;
      }
      serial++;
    }

    const newsFilePath = path.join(NEWS_DIR, `${newsId}.html`);

    if (!fs.existsSync(TEMPLATE_PATH)) {
      console.error(`[Error] 뉴스 템플릿이 없습니다: ${TEMPLATE_PATH}`);
      return;
    }

    let templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    const urlSection = `<a href="${sourceUrl}" class="src-link" target="_blank" rel="noopener">🔗 ดูประกาศต้นฉบับ (Facebook) / View Original Notice</a>`;

    let htmlRendered = templateContent
      .replace(/\{\{TITLE_TH\}\}/g, titleTh)
      .replace(/\{\{TITLE_KO\}\}/g, "Kori Care News Feed")
      .replace(/\{\{DATE\}\}/g, todayStr)
      .replace(/\{\{CONTENT_TH\}\}/g, contentTh)
      .replace(/\{\{CONTENT_KO\}\}/g, "<p>본문 내용은 페이스북 원본 게시글을 확인해주세요.</p>")
      .replace(/\{\{URL_SECTION\}\}/g, urlSection)
      .replace(/\{\{DESC_TH\}\}/g, titleTh)
      .replace(/\{\{NEWS_ID\}\}/g, newsId);

    fs.writeFileSync(newsFilePath, htmlRendered, 'utf-8');
    console.log(`[Success] 정적 기사 파일 저장 완료: news/${newsId}.html`);

    const newItem = {
      id: newsId,
      title_th: titleTh,
      title_ko: "Kori Care Facebook Post",
      date: todayStr,
      url: sourceUrl,
      image: item.image
    };

    existingNews.unshift(newItem);
    newPostsProcessed++;
  }

  if (newPostsProcessed > 0) {
    const keptList = existingNews.slice(0, 50);
    const removedList = existingNews.slice(50);
    // HTML files are kept permanently to prevent 404s.
    fs.writeFileSync(NEWS_LIST_PATH, JSON.stringify(keptList, null, 2), 'utf-8');
    existingNews = keptList;
    console.log(`\n🎉 총 ${newPostsProcessed}개의 페이스북 새 글 동기화 완료!`);
  } else {
    console.log("\n✅ 동기화할 새로운 페이스북 포스트가 없습니다. 최신 상태입니다.");
  }

  // Always update index.html with 3 random news cards to make the layout dynamic
  if (existingNews.length > 0) {
    if (fs.existsSync(INDEX_PATH)) {
      let indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
      const startMarker = "<!-- NEWS_START -->";
      const endMarker = "<!-- NEWS_END -->";
      const startIdx = indexContent.indexOf(startMarker);
      const endIdx = indexContent.indexOf(endMarker);

      if (startIdx !== -1 && endIdx !== -1) {
        // Select 3 random unique items from the entire synced news list
        const shuffled = [...existingNews].sort(() => 0.5 - Math.random());
        const randomItems = shuffled.slice(0, Math.min(3, shuffled.length));

        const newsItemsHtml = randomItems.map(item => {
          const cardImage = item.image || "koricare_main_logo_nobg.png";
          return `    <a href="news/${item.id}.html" class="news-card">
      <img src="${cardImage}" alt="${item.title_th}">
    </a>`;
        });

        const newsBlock = newsItemsHtml.join('\n');
        const updatedIndex = indexContent.substring(0, startIdx + startMarker.length) +
          "\n" + newsBlock + "\n    " +
          indexContent.substring(endIdx);

        fs.writeFileSync(INDEX_PATH, updatedIndex, 'utf-8');
        console.log("[Success] index.html 뉴스 카드 무작위 갱신 완료!");
      }
    }
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
});
