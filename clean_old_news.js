const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// 보존 기간. 이 숫자만 바꾸면 정리 주기가 바뀐다.
// 뉴스 상세 페이지는 전부 noindex + 사이트맵 미포함이라
// 검색 색인에 잡히지 않는다 → 짧게 잡아도 SEO 손실이 없다.
// 다만 외부(페북 등)에 공유한 뉴스 링크는 이 기간이 지나면 404가 된다.
const MAX_AGE_DAYS = 40;
// ─────────────────────────────────────────────────────────────

const BASE_DIR = __dirname;
const NEWS_DIR = path.join(BASE_DIR, 'news');
const IMAGES_DIR = path.join(NEWS_DIR, 'images');
const DATA_DIR = path.join(BASE_DIR, 'data');

const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const now = Date.now();

// 파일 내용에서 발행일을 뽑는다.
// git checkout은 타임스탬프를 보존하지 않으므로 birthtime/mtime은 쓸 수 없다.
// (액션 러너에서는 모든 파일의 birthtime이 체크아웃 시각이 된다)
function extractDate(html) {
  let m = html.match(/date-bar">\s*(\d{4}-\d{2}-\d{2})/);            // auto_fetch_news.js 생성분
  if (m) return Date.parse(m[1] + 'T00:00:00Z');

  m = html.match(/อัปเดตเมื่อ:\s*([A-Za-z]{3}\s+\d{1,2},\s*\d{4})/);  // build_thai_hotnews.js 생성분
  if (m) { const t = Date.parse(m[1]); if (!isNaN(t)) return t; }

  m = html.match(/(20\d{2}-\d{2}-\d{2})/);                            // 마지막 수단
  if (m) return Date.parse(m[1] + 'T00:00:00Z');

  return null;
}

// 인덱스 페이지에 걸려 있는 뉴스는 나이와 무관하게 지키다.
function loadProtectedIds() {
  const keep = new Set();
  if (!fs.existsSync(DATA_DIR)) return keep;
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (!/^news_list_.*\.json$/.test(f)) continue;
    try {
      for (const it of JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'))) {
        if (it && it.id) keep.add(it.id + '.html');
      }
    } catch (e) { /* 깨진 JSON은 무시 */ }
  }
  return keep;
}

const protectedIds = loadProtectedIds();
let deleted = 0, kept = 0, undated = 0, guarded = 0;

for (const file of fs.readdirSync(NEWS_DIR)) {
  if (!file.endsWith('.html')) continue;
  const filePath = path.join(NEWS_DIR, file);
  if (!fs.statSync(filePath).isFile()) continue;

  if (protectedIds.has(file)) { guarded++; kept++; continue; }

  const published = extractDate(fs.readFileSync(filePath, 'utf-8'));
  if (published === null || isNaN(published)) { undated++; kept++; continue; }

  if (now - published > MAX_AGE_MS) {
    try {
      fs.unlinkSync(filePath);
      deleted++;
    } catch (e) {
      console.error('삭제 실패 ' + file + ':', e.message);
    }
  } else {
    kept++;
  }
}

// 이미지는 나이가 아니라 참조 여부로 지운다. 남은 뉴스가 쓰는 이미지는 보존.
let imgDeleted = 0, imgKept = 0;
if (fs.existsSync(IMAGES_DIR)) {
  const referenced = new Set();
  // 저장소 전체의 HTML을 훑는다. news/images/ 는 뉴스뿐 아니라
  // en·th·vi 가이드 페이지에서도 참조하므로 범위를 좁히면 살아있는 이미지를 지운다.
  const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'scratch']);
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.html')) {
        const html = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
        for (const m of html.matchAll(/news\/images\/([^"'\s>?]+)/g)) referenced.add(m[1]);
      }
    }
  })(BASE_DIR);
  for (const img of fs.readdirSync(IMAGES_DIR)) {
    if (referenced.has(img)) { imgKept++; continue; }
    try { fs.unlinkSync(path.join(IMAGES_DIR, img)); imgDeleted++; }
    catch (e) { console.error('이미지 삭제 실패 ' + img + ':', e.message); }
  }
}

console.log('보존 기간: ' + MAX_AGE_DAYS + '일');
console.log('  뉴스 삭제 : ' + deleted + '개');
console.log('  뉴스 보존 : ' + kept + '개  (인덱스 링크 보호 ' + guarded + ', 날짜 못 읽음 ' + undated + ')');
console.log('  이미지 삭제: ' + imgDeleted + '개 / 보존 ' + imgKept + '개');
console.log('✅ 날짜 기준 정리 완료.');
