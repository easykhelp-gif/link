// 이미 만들어진 뉴스 페이지를 새 템플릿으로 다시 그린다.
//
// auto_fetch_news.js 는 새로 들어온 기사만 만든다. 템플릿을 고쳐도
// 이미 있는 페이지는 옛 화면 그대로다. 목록에 걸린 페이지는 사람이 지금
// 클릭하는 것이므로 즉시 반영되어야 한다.
//
// 요약은 다시 뽑지 않는다. 기존 HTML 에서 본문을 꺼내 그대로 쓴다.
// (AI 호출 0회, 비용 0원)
//
//   node rebuild_news_pages.js --dry
//   node rebuild_news_pages.js          목록에 걸린 것만 (기본)
//   node rebuild_news_pages.js --all    news/ 안의 모든 기사

const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const NEWS_DIR = path.join(BASE, 'news');
const DATA_DIR = path.join(BASE, 'data');
const dry = process.argv.includes('--dry');
const all = process.argv.includes('--all');

// auto_fetch_news.js 에서 렌더 함수만 빌려 온다. 템플릿을 두 벌 두면 어긋난다.
const src = fs.readFileSync(path.join(BASE, 'auto_fetch_news.js'), 'utf8')
  .replace(/\nrunPipeline\(\);\s*$/, '\n')
  .replace(/^const \{ GoogleGenAI \} = require\(['"]@google\/genai['"]\);$/m,
           'const GoogleGenAI = function () {};');
const mod = { exports: {} };
new Function('module', 'exports', 'require', '__dirname',
  src + '\nmodule.exports = { buildArticleHtml };')(mod, mod.exports, require, BASE);
const { buildArticleHtml } = mod.exports;

// 옛 페이지에서 되살려야 할 것들
function extract(html) {
  const pick = (re) => { const m = html.match(re); return m ? m[1] : ''; };
  const unesc = (s) => String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');

  const title = unesc(pick(/<h1[^>]*>([\s\S]*?)<\/h1>/)).trim();
  const date = pick(/<div class="date-bar">([^<]*)<\/div>/).trim();
  const image = pick(/<img src="([^"]+)"[^>]*style="width:100%; max-height:380px/) ||
                pick(/class="hero-img"[^>]*>/) || '';
  const link = pick(/<a href="([^"]+)"[^>]*class="src-link[^"]*"/) ||
               pick(/class="src-link-subtle"[^>]*>/) || '';

  // 본문(요약). 옛 템플릿과 새 템플릿 둘 다 받는다.
  let desc = '';
  const oldBody = html.match(/<div class="article-content">\s*<div[^>]*>([\s\S]*?)<\/div>/);
  if (oldBody) {
    desc = unesc(oldBody[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
  } else {
    const newBody = html.match(/<section class="summary">([\s\S]*?)<\/section>/);
    if (newBody) {
      desc = unesc(newBody[1]
        .replace(/<h2[^>]*>[\s\S]*?<\/h2>/, '')
        .replace(/<li>/g, '\n- ')
        .replace(/<strong>/g, '**').replace(/<\/strong>/g, '**')
        .replace(/<[^>]+>/g, '')).trim();
    }
  }
  return { title, date, image, link, desc };
}

// 어떤 파일을 고칠지 고른다
let targets = [];
if (all) {
  targets = fs.readdirSync(NEWS_DIR)
    .filter(f => /^hotnews_(en|th|vi)_.*\.html$/.test(f))
    .map(f => ({ file: f, lang: f.split('_')[1] }));
} else {
  for (const lang of ['en', 'th', 'vi']) {
    const p = path.join(DATA_DIR, `news_list_${lang}.json`);
    if (!fs.existsSync(p)) continue;
    for (const item of JSON.parse(fs.readFileSync(p, 'utf8'))) {
      if (item.id) targets.push({ file: item.id + '.html', lang, meta: item });
    }
  }
}

let done = 0, skipped = 0, missing = 0;
const perLang = {};

for (const t of targets) {
  const p = path.join(NEWS_DIR, t.file);
  if (!fs.existsSync(p)) { missing++; continue; }
  const html = fs.readFileSync(p, 'utf8');

  // 이미 새 템플릿이면 건드리지 않는다
  if (html.indexOf('class="summary-label"') >= 0) { skipped++; continue; }

  const got = extract(html);
  const m = t.meta || {};
  const item = {
    id: t.file.replace(/\.html$/, ''),
    title: got.title || m.title || '',
    desc: got.desc,
    link: got.link || m.link || '',
    image: got.image || m.image || '',
    date: got.date || m.date || ''
  };
  if (!item.title) { skipped++; continue; }

  if (!dry) fs.writeFileSync(p, buildArticleHtml(item, t.lang), 'utf8');
  done++;
  perLang[t.lang] = (perLang[t.lang] || 0) + 1;
}

console.log((dry ? '[미리보기] ' : '') + '다시 그림 ' + done + '건' +
            (all ? '  (news/ 전체)' : '  (목록에 걸린 것만)'));
console.log('  언어별: ' + JSON.stringify(perLang));
console.log('  이미 새 템플릿이거나 제목 없음: ' + skipped + '건');
console.log('  파일 없음: ' + missing + '건');
