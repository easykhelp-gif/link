// 월간 정리를 만들려면 한 달치가 필요한데, 뉴스 HTML 은 3일이면 지워진다.
// 그래서 "쓸 만한 기사"만 골라 작은 보관 파일에 쌓아 둔다.
//
//   data/news_archive_{lang}.json
//   [{ id, date, title, bullets[], link, section }]
//
// HTML 한 장이 6KB 인데 보관 항목은 0.5KB 안팎이다.
// 한 달에 언어당 30건이면 1년치가 500KB 가 안 된다.
// 13개월이 지난 것은 버린다.
//
// auto_fetch_news.js 가 기사를 만들 때마다 부르고,
// build_monthly_digest.js 가 읽는다.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const KEEP_MONTHS = 13;

// 한 달·한 갈래에 이만큼만 쌓는다.
//
// 상한이 없으면 하루 60건 × 30일 = 월 1,800건까지 쌓여 한 해에 30MB 를 넘는다.
// 월간 정리에 실리는 것은 갈래당 최대 6건이므로 12건만 있어도 고를 것이 충분하다.
//
//   12건 × 3갈래 × 3언어 × 13개월 × 약 0.5KB = 약 700KB
//
// 뉴스 HTML 한 장이 6KB 인 것과 비교하면 보관 파일 전체가 HTML 120장 크기다.
const MAX_PER_MONTH_SECTION = 12;

// 세 갈래. build_monthly_digest.js 와 같은 기준을 써야 하므로 여기서 정한다.
const SECTIONS = [
  { key: 'incident', re: /crash|accident|fire|collapse|flood|typhoon|earthquake|quake|storm|landslide|death|died|killed|injur|rescue|missing|explosion|scam|fraud|phishing|theft|assault|arrest|crime|police|court|indict|safety|outbreak|infection|virus|recall/i },
  { key: 'living',   re: /visa|immigration|residence|sojourn|alien registration|E-9|EPS|employment permit|work permit|deport|minimum wage|wage|labor|labour|severance|pension|health insurance|NHIS|medical|hospital|tax|rent|jeonse|housing|price|inflation|subsidy|budget|welfare|multicultural|foreign(er|ers)?|migrant|school|university|transport|subway|KTX|policy|ministry|government/i },
  { key: 'culture',  re: /K-pop|BTS|BLACKPINK|idol|album|concert|actor|actress|drama|film|movie|entertainment|celebrity|festival|award|Netflix|variety show|singer|comeback|box office|sport|football|baseball|Olympic/i }
];

// 갈래 판정은 영어 원문 제목으로 한다.
// 번역본으로 판정하면 언어마다 결과가 달라져 같은 기사가 다른 갈래에 들어간다.
function classify(text) {
  for (const s of SECTIONS) if (s.re.test(text)) return s.key;
  return null;
}

function pathFor(lang) { return path.join(DATA_DIR, `news_archive_${lang}.json`); }

function load(lang) {
  const p = pathFor(lang);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return []; }
}

function cutoffMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - KEEP_MONTHS);
  return d.toISOString().slice(0, 7);
}

// 기사 한 건을 보관한다.
//   sourceTitle  갈래 판정에 쓸 영어 원문 제목
//   item         화면에 나가는 것 (번역된 제목, 요약 줄, 링크, 날짜)
function add(lang, item, sourceTitle) {
  if (!item || !item.id || !item.title) return false;
  const bullets = String(item.desc || '').split('\n')
    .map(s => s.replace(/^\s*[-*•·]\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean);
  // 요약이 두 줄 미만이면 보관하지 않는다. 월간 정리에 실을 수 없다.
  if (bullets.length < 2) return false;

  const section = classify(sourceTitle || item.title);
  if (!section) return false;              // 세 갈래 어디에도 안 걸리면 안 쌓는다

  const list = load(lang);
  if (list.some(x => x.id === item.id || x.link === item.link)) return false;

  // 그 달·그 갈래가 이미 찼으면 더 쌓지 않는다. 파일이 무한정 커지는 것을 막는다.
  const month = String(item.date || '').slice(0, 7);
  const inBucket = list.filter(x => (x.date || '').slice(0, 7) === month && x.section === section).length;
  if (inBucket >= MAX_PER_MONTH_SECTION) return false;

  list.push({
    id: item.id,
    date: item.date,
    title: item.title,
    bullets,
    link: item.link || '',
    section
  });

  // 오래된 것 정리 + 최신순
  const cut = cutoffMonth();
  const kept = list
    .filter(x => (x.date || '').slice(0, 7) >= cut)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  fs.mkdirSync(DATA_DIR, { recursive: true });
  // 들여쓰기 없이 쓴다. 사람이 읽을 파일이 아니고, 들여쓰기가 용량의 3할이다.
  fs.writeFileSync(pathFor(lang), JSON.stringify(kept), 'utf8');
  return true;
}

// 특정 달의 기사를 꺼낸다
function ofMonth(lang, month) {
  return load(lang).filter(x => (x.date || '').slice(0, 7) === month);
}

module.exports = { add, load, ofMonth, classify, SECTIONS, KEEP_MONTHS };
