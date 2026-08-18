const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');

function injectGridCardsToIndex(newsList, lang) {
  const indexHtmlPath = lang === 'en'
    ? path.join(BASE_DIR, 'index.html')
    : path.join(BASE_DIR, lang, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) return;

  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

  // Generate the new news cards chunk
  let newCardsHtml = '';
  const topNews = newsList.slice(0, 5); // display 5 items
  topNews.forEach(item => {
    // Generate absolute path to the generated HTML file
    const href = `/link/news/${item.id}.html`;
    const fallbackImage = "this.onerror=null;this.src='https://www.koricare.kr/link/koricare_main_logo_nobg.png';";
    
    newCardsHtml += `    <a href="${href}" class="list-item-card" style="display:flex; flex-direction:row; padding:14px 0; border-bottom:1px solid var(--line); text-decoration:none; transition:all 0.2s ease; align-items:center;">
        <div class="list-thumb" style="width:96px; height:72px; flex-shrink:0; border-radius:12px; background:#f1f5f9; overflow:hidden; margin-right:14px;">
          <img src="${item.img || ''}" alt="${item.title.replace(/"/g, '&quot;')}" onerror="${fallbackImage}" style="width:100%; height:100%; object-fit:cover; display:block;">
        </div>
        <div class="list-text" style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center;">
          <div class="list-title" style="font-size:14.5px; font-weight:700; color:#1e293b; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word;">
            ${item.title}
          </div>
          <div class="list-date" style="font-size:11px; font-weight:600; color:#94a3b8; margin-top:6px; text-transform:uppercase; letter-spacing:0.3px;">
            ${item.date || ''}
          </div>
        </div>
    </a>\n`;
  });

  const startMarker = '<!-- NEWS_START -->';
  const endMarker = '<!-- NEWS_END -->';
  const startIdx = htmlContent.indexOf(startMarker);
  const endIdx = htmlContent.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    const before = htmlContent.substring(0, startIdx + startMarker.length);
    const after = htmlContent.substring(endIdx);
    
    const blockStart = `\n  <div class="news-list" id="news-list" style="display:flex; flex-direction:column; margin-bottom:28px;">\n`;
    const blockEnd = `    <a href="${lang === 'en' ? '' : '../'}news_archive.html" style="display:flex; justify-content:center; align-items:center; gap:8px; padding:12px; background:#f8fafc; color:#475569; border:1px solid #e2e8f0; border-radius:12px; font-weight:700; font-size:13.5px; text-decoration:none; margin-top:8px; transition:all 0.2s ease;" onmouseover="this.style.background='#f1f5f9'; this.style.color='#1e293b';" onmouseout="this.style.background='#f8fafc'; this.style.color='#475569';">View All News ➔</a>\n  </div>\n  `;

    const updatedHtml = before + blockStart + newCardsHtml + blockEnd + after;
    fs.writeFileSync(indexHtmlPath, updatedHtml, 'utf8');
    console.log(`Successfully updated ${lang} index.html with top 5 news.`);
  }
}

const langs = ['en', 'th', 'vi'];
for (const lang of langs) {
  const jsonPath = path.join(DATA_DIR, `news_list_${lang}.json`);
  if (fs.existsSync(jsonPath)) {
    const newsList = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    injectGridCardsToIndex(newsList, lang);
  }
}
