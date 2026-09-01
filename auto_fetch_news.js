const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const { GoogleGenAI } = require('@google/genai');

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

// 세 언어 모두 한국 뉴스를 받는다.
//
// 2026-09-01 이전에는 태국어·베트남어가 그 나라 국내 뉴스를 받고 있었다.
// 실측: 태국어 50건 중 한국 관련 1건(2%), 베트남어 50건 중 0건.
// 파리가 옮기는 병원균, 메시, 캄보디아 사업 철수 같은 기사였다.
// 한국 사는 사람에게 쓸모가 없고, 쌓여도 카오솟 기사 요약본일 뿐이라
// 우리 자산이 되지 않는다.
//
// 이제 연합뉴스 영문을 받아 태국어·베트남어로 옮겨서 낸다.
// 태국어로 된 한국 뉴스는 세상에 거의 없다. 옮기는 일 자체가 우리 몫이다.
// 한 곳만 보면 그 매체가 그날 무엇을 크게 다뤘는지에 끌려간다.
// 네 곳을 보고, 둘 이상이 함께 다루는 것을 먼저 고른다. (2026-09-01 실측으로 살아있음 확인)
const KOREA_FEEDS = [
  'https://en.yna.co.kr/RSS/news.xml',           // 연합뉴스 영문   104건
  'https://www.koreaherald.com/rss/newsAll',      // 코리아헤럴드     50건
  'http://world.kbs.co.kr/rss/rss_news.htm?lang=e', // KBS World     30건
  'https://www.koreatimes.co.kr/www/rss/nation.xml' // 코리아타임스   19건
];

const RSS_FEEDS = {
  en: KOREA_FEEDS,
  th: KOREA_FEEDS,
  vi: KOREA_FEEDS
};

// 원문이 영어라 번역이 필요한 언어. 번역이 실패하면 그 기사는 내보내지 않는다.
// 영어 제목이 태국어 페이지에 뜨면 지금보다 나빠진다.
const NEEDS_TRANSLATION = { th: 'Thai', vi: 'Vietnamese' };

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    // 통신사 내부 표시. 독자에게는 뜻이 없는 말이라 걷어낸다.
    //   (URGENT) (LEAD) (2nd LD) (News Focus) (Yonhap Interview) …
    .replace(/^\s*\((?:URGENT|LEAD|\d+(?:st|nd|rd|th)\s+LD|News Focus|Yonhap [^)]+|Newsmaker|Update|Photo|Graphic)\)\s*/i, '')
    .replace(/\uFFFD/g, '')
    // \uC5D4\uD2F0\uD2F0\uB294 \uAE00\uC790\uB85C \uB418\uB3CC\uB9B0\uB2E4. \uC9C0\uC6CC \uBC84\uB9AC\uBA74 \uC548 \uB41C\uB2E4.
    // \uC608\uC804\uC5D0\uB294 &#\d+; \uB97C \uD1B5\uC9F8\uB85C \uC9C0\uC6CC\uC11C, \uD0DC\uAD6D \uB9E4\uCCB4\uAC00 \uBCF4\uB0B8 "[&#8230;]" \uC774
    // \uB300\uAD04\uD638\uB9CC \uB0A8\uC740 "[]" \uAC00 \uB418\uC5B4 \uD654\uBA74\uC5D0 \uADF8\uB300\uB85C \uB098\uAC14\uB2E4.
    .replace(/&(#\d+|#x[0-9a-fA-F]+|amp|lt|gt|quot|apos|nbsp|hellip|mdash|ndash|lsquo|rsquo|ldquo|rdquo);/g, function (m, e) {
      var named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
                    hellip: '\u2026', mdash: '\u2014', ndash: '\u2013',
                    lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D' };
      var k = e.toLowerCase();
      if (named[k] !== undefined) return named[k];
      if (k.charAt(0) === '#') {
        var n = k.charAt(1) === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
        return isFinite(n) && n > 0 ? String.fromCodePoint(n) : '';
      }
      return '';
    })
    // \uB9E4\uCCB4\uAC00 \uBCF8\uBB38\uC744 \uC790\uB97C \uB54C \uBD99\uC774\uB294 \uD45C\uC2DC. \uB0A8\uC73C\uBA74 \uBB38\uC7A5\uC774 \uB04A\uAE34 \uAC83\uCC98\uB7FC \uBCF4\uC778\uB2E4.
    .replace(/\[\s*(?:\.\.\.|\u2026)?\s*\]/g, '')
    .replace(/(?:\.\.\.|\u2026)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// href/src 전용. http(s) 절대경로와 콜론 없는 상대경로만 통과.
// javascript:, data:, vbscript: 등 스킴은 전부 '#'으로 차단.
function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '#';
  if (/^https?:\/\//i.test(s) && !/[\s<>"']/.test(s)) return escapeHtml(s);
  if (!/[:\s<>"']/.test(s)) return escapeHtml(s);
  return '#';
}

function fetchUrl(url, redirectsLeft = 3) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (res) => {
      // 301/302 를 따라가지 않으면 빈 문자열이 돌아온다.
      // 실측: tuoitre.vn RSS 가 301, vnexpress 기사가 302 라 본문이 0자였다.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        const next = new URL(res.headers.location, url).href;
        return resolve(fetchUrl(next, redirectsLeft - 1));
      }
      // setEncoding 없이 Buffer 를 문자열에 더하면 태국어·베트남어처럼
      // 멀티바이트 문자가 청크 경계에서 쪼개져 깨진다.
      res.setEncoding('utf8');
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
      // 매체가 미래 날짜를 주는 일이 있다. 실측: 태국 매체가 2026-09-01 에
      // 2026-09-03 짜리 기사를 내보냈다.
      // 정렬이 최신순이라 그런 기사가 목록 맨 앞에 박히고,
      // 3일 보존은 미래 날짜를 영원히 지우지 못한다.
      // 오늘보다 뒤면 오늘로 끌어내린다.
      const now = Date.now();
      let ts = pubDateMatch && !isNaN(new Date(pubDateMatch[1]).getTime())
        ? new Date(pubDateMatch[1]).getTime() : now;
      if (ts > now) ts = now;

      items.push({
        title: cleanTitle,
        link: cleanLink,
        desc: cleanDesc,
        image: actualImg,
        date: new Date(ts).toISOString().slice(0, 10),
        // 정렬용 발행 시각(ms). date는 일 단위라 같은 날 기사 순서를 못 가림.
        ts
      });
    }
  }
  return items;
}

// 요약 앞에 붙는 군말을 걷어낸다.
// 모델이 "Here is a 3-bullet point summary of the news:" 같은 인사말을 먼저 쓰는데,
// 그게 그대로 화면에 나오고 있었다.
function stripPreamble(text) {
  const lines = String(text || '').split('\n');
  while (lines.length) {
    const t = lines[0].trim();
    if (!t) { lines.shift(); continue; }
    // 목록 기호로 시작하면 본문이다
    if (/^([*\-•·]|\d+[.)])\s/.test(t)) break;
    // 콜론으로 끝나는 짧은 안내문이면 버린다
    if (t.length <= 120 && /[:：]\s*$/.test(t)) { lines.shift(); continue; }
    break;
  }
  return lines.join('\n').trim();
}

// 모델이 돌려준 마크다운을 화면용 HTML 로 바꾼다.
// 예전에는 줄바꿈만 <br> 로 바꿔서 "* **재난과 구조:**" 의 별표가 그대로 보였다.
function renderSummary(text, fallbackTitle) {
  const raw = stripPreamble(text);
  if (!raw) return '<p>' + escapeHtml(fallbackTitle) + '</p>';

  const bold = (s) => escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>');

  const out = [];
  let list = null;
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^([*\-•·]|\d+[.)])\s+(.*)$/);
    if (m) {
      if (!list) list = [];
      list.push('<li>' + bold(m[2]) + '</li>');
    } else {
      if (list) { out.push('<ul class="sum-list">' + list.join('') + '</ul>'); list = null; }
      out.push('<p>' + bold(t) + '</p>');
    }
  }
  if (list) out.push('<ul class="sum-list">' + list.join('') + '</ul>');
  return out.join('');
}

const GEMINI = require('./gemini_config');
const newsArchive = require('./news_archive');

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// 요약 한 건. 호출 한도에 걸리면 잠깐 쉬었다 다시 시도하고,
// 모델이 은퇴했으면(404) 대체 모델로 한 번 더 시도한다.
async function summarizeOnce(ai, prompt) {
  const models = [GEMINI.MODEL, GEMINI.MODEL_FALLBACK];
  let lastErr = null;

  for (const model of models) {
    for (let attempt = 0; attempt <= GEMINI.RETRY; attempt++) {
      try {
        const res = await ai.models.generateContent({ model, contents: prompt });
        if (res && res.text) {
          if (model !== GEMINI.MODEL) {
            console.warn(`[모델 대체] ${GEMINI.MODEL} 실패 → ${model} 로 성공. gemini_config.js 를 고칠 것.`);
          }
          return res.text;
        }
        lastErr = new Error('빈 응답');
      } catch (e) {
        lastErr = e;
        const msg = String((e && e.message) || e);
        // 호출 한도 — 쉬었다 다시
        if (/429|RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg) && attempt < GEMINI.RETRY) {
          await new Promise(r => setTimeout(r, GEMINI.RETRY_WAIT_MS));
          continue;
        }
        // 모델이 없음 — 다음 모델로
        if (/404|not found|NOT_FOUND|is not supported/i.test(msg)) break;
        break;
      }
    }
  }
  throw lastErr || new Error('요약 실패');
}

// 어떤 기사를 먼저 처리할지 점수를 매긴다.
//
// 한 회차에 물어오는 기사는 수십 건인데 요약 몫은 언어당 10건이다.
// 아무거나 먼저 잡으면 조선업 수주나 주가 기사가 자리를 차지한다.
// 한국 사는 사람이 실제로 찾아볼 것부터 쓴다.
const TOPIC_WEIGHT = [
  // 제도·생활 — 바로 영향을 받는 것
  [/visa|immigration|residence|deport|sojourn|alien registration/i, 10],
  [/foreign(er|ers)?|migrant|multicultural|expat/i, 9],
  [/employment permit|work permit|E-9|EPS|labor|labour|wage|minimum wage/i, 9],
  [/health insurance|NHIS|medical|hospital|pension|industrial accident|workplace safety/i, 8],
  [/housing|jeonse|rent|deposit|scam|fraud|phishing/i, 7],
  [/tax|remittance|exchange rate|won-dollar|bank/i, 6],
  // 한국 생활·문화·연예 — 관심으로 들어오는 것
  [/K-pop|BTS|BLACKPINK|idol|actor|actress|drama|film|entertainment|celebrity/i, 6],
  [/festival|holiday|Chuseok|Seollal|weather|typhoon|heat wave|snow/i, 5],
  [/subway|KTX|transport|airport|traffic/i, 4],
  [/university|student|scholarship|school/i, 4],
  // 굳이 먼저 다룰 이유가 없는 것 — 뒤로 민다
  [/shares|stocks|KOSPI|bond|won order|shipbuilding|semiconductor export/i, -4],
  [/(URGENT)|\(LEAD\)|\(2nd LD\)/i, -1]
];

function topicScore(item) {
  const t = (item.title || '') + ' ' + (item.desc || '');
  let s = 0;
  for (const [re, w] of TOPIC_WEIGHT) if (re.test(t)) s += w;
  return s;
}

// 영어 원문을 그 나라 말로 옮기고 3줄로 줄인다.
// 제목까지 같이 받아야 한다. 제목만 영어로 남으면 페이지가 반쪽이 된다.
async function translateAndSummarize(ai, fullText, title, langName) {
  const prompt =
    `You are preparing a Korean news item for ${langName} speakers who live in South Korea.\n\n` +
    `Write in ${langName} only. Output exactly this shape and nothing else:\n\n` +
    `TITLE: <the headline in ${langName}, under 70 characters>\n` +
    `- <fact 1>\n` +
    `- <fact 2>\n` +
    `- <fact 3>\n\n` +
    `Rules:\n` +
    `- No preamble, no heading, no closing remark.\n` +
    `- One fact per bullet, 1 to 2 sentences, plain words.\n` +
    `- Keep Korean proper nouns recognisable.\n` +
    `- Do not invent anything that is not in the article.\n\n` +
    `Article (English):\n${title}\n\n${fullText}`;

  const raw = await summarizeOnce(ai, prompt);
  const lines = String(raw).split('\n');
  let outTitle = '';
  const body = [];
  for (const line of lines) {
    const m = line.match(/^\s*TITLE\s*[:：]\s*(.+)$/i);
    if (m && !outTitle) { outTitle = m[1].trim(); continue; }
    if (line.trim()) body.push(line);
  }
  const summary = stripPreamble(body.join('\n'));
  // 제목이나 본문이 비면 실패로 본다. 반쪽짜리를 내보내지 않는다.
  if (!outTitle || !summary) throw new Error('번역 결과가 불완전하다');
  return { title: outTitle, summary };
}

// ── 여러 매체가 함께 다루는 것 ─────────────────────────────────
//
// 같은 사건을 매체마다 다른 문장으로 쓴다. 제목에서 흔한 말을 걷어내고
// 남은 낱말이 겹치면 같은 사건으로 본다.
const STOP_WORDS = new Set(['the','a','an','of','in','on','at','to','for','and','or','with','by',
  'from','as','is','are','was','were','be','been','has','have','had','it','its','this','that',
  'over','after','before','amid','said','says','new','more','than','pct','percent','korea',
  'korean','south','seoul','north','yonhap','update','lead','urgent','photo','news','report']);

function keyWords(title) {
  return new Set(String(title).toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w)));
}

// 두 기사가 같은 사건인가. 뜻이 담긴 낱말이 둘 이상 겹치면 같다고 본다.
function sameStory(a, b) {
  const x = keyWords(a.title), y = keyWords(b.title);
  if (x.size < 2 || y.size < 2) return false;
  let hit = 0;
  for (const w of x) if (y.has(w)) hit++;
  return hit >= 2;
}

// 같은 사건을 묶는다.
//
// 네 매체가 같은 사건을 저마다 다른 제목으로 쓴다.
//   "Police disclose identity of Chinese man suspected of murdering..."
//   "Police identify suspect in killing of Chinese student"
//   "Police Reveal Identity of Chinese Lecturer Accused of Killing..."
// 제목이 달라 중복 제거에 안 걸리고, 그대로 두면 뉴스 세 칸이 같은 사건으로 찬다.
//
// 묶은 뒤 대표 한 건만 남기고, 몇 개 매체가 다뤘는지를 그 건에 달아 준다.
function clusterStories(items) {
  const clusters = [];
  for (const it of items) {
    const c = clusters.find(c => c.some(x => sameStory(x, it)));
    if (c) c.push(it); else clusters.push([it]);
  }
  return clusters.map(group => {
    const outlets = new Set(group.map(x => x.source));
    // 대표는 제목이 가장 구체적인 것 — 뜻이 담긴 낱말이 많은 쪽
    const lead = group.slice().sort((a, b) => keyWords(b.title).size - keyWords(a.title).size)[0];
    lead.coverage = outlets.size;
    lead.outlets = [...outlets];
    return lead;
  });
}

// ── 코리케어의 시선 ────────────────────────────────────────────
//
// 기사에 없는 각도를 붙이는 것이 이 서비스가 하는 일이다.
// 자동차 판매 기사도 "부품사 잔업이 줄어든다"로 읽으면 우리 독자의 일이 된다.
//
// 다만 모델이 법 조항이나 금액을 지어내면 틀린 정보가 나간다.
// 아래 목록에 있는 것만 인용하게 하고, 그 밖의 숫자·조문은 금지한다.
const VERIFIED_FACTS = [
  '휴업수당 (shutdown pay): if the employer suspends work, the worker is owed 70% of average wage under the Labor Standards Act.',
  '퇴직금 (severance pay): any worker employed continuously for one year or more is entitled to it, regardless of nationality or visa.',
  'E-9 workers may change workplace within the same industry under the Employment Permit System; the number of changes is limited by law.',
  '1345 — Immigration Contact Center, about 20 languages.',
  '1339 — medical information and emergency guidance, interpretation available.',
  '119 — ambulance and fire, multilingual dispatch.',
  '1577-1366 — Danuri call centre, 24 hours, 15 languages.',
  '응급의료비 대지급제도: the state can pay an emergency room bill on the spot and be repaid in instalments; not limited to citizens or the insured.',
  'Foreign residents staying six months or more must enrol in National Health Insurance.'
];

async function writeAngle(ai, item, langName) {
  const prompt =
    `You write one short passage for Kori Care, a guide site read by people living in South Korea ` +
    `on a foreign passport — mostly E-9 manufacturing workers, students, and marriage migrants ` +
    `from Thailand, Vietnam, Nepal and the Philippines.\n\n` +
    `News item:\n${item.title}\n${String(item.desc || '').slice(0, 1200)}\n\n` +
    `Write in ${langName}: what this means for that reader. Find the angle the article does not ` +
    `state. A car maker's sales figure is really about overtime at its parts suppliers. ` +
    `An exchange rate move is really about the money they send home. ` +
    `A parliamentary session is really about next year's permit quota.\n\n` +
    `Rules:\n` +
    `- Two sentences. No heading, no label, no preamble, no quotation marks.\n` +
    `- Be concrete and calm. Do not exaggerate, do not frighten, do not use exclamation marks.\n` +
    `- You may cite ONLY facts stated in the article above, or from this list, and nothing else:\n` +
    VERIFIED_FACTS.map(f => '    * ' + f).join('\n') + '\n' +
    `- Invent no law, no article number, no amount, no percentage, no date beyond those.\n` +
    `- If this item genuinely has no bearing on such a reader's life, reply with exactly: SKIP\n`;

  const raw = await summarizeOnce(ai, prompt);
  const t = String(raw || '').trim()
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(here is|below is|this means)[^\n:]*:\s*/i, '');
  if (!t || /^SKIP$/i.test(t)) return '';
  // 너무 짧으면 알맹이가 없고, 너무 길면 요약을 덮는다
  const len = t.replace(/\s+/g, '').length;
  if (len < 45 || len > 420) return '';
  if (/\n/.test(t.trim())) return t.split('\n').filter(Boolean)[0];   // 여러 줄이면 첫 줄만
  return t;
}

// 화면 문구
const NEWS_UI = {
  en: { summary: 'Summary', source: 'Original report',
        cta: 'Visa, labour rights, or legal trouble in Korea? Talk to a specialist.',
        btn: 'Kori Care 1:1 Help', back: 'Back to Kori Care' },
  th: { summary: 'สรุปข่าว', source: 'ข่าวต้นฉบับ',
        cta: 'มีปัญหาเรื่องวีซ่า สิทธิแรงงาน หรือกฎหมายในเกาหลี? ปรึกษาผู้เชี่ยวชาญ',
        btn: 'Kori Care ปรึกษา 1:1', back: 'กลับสู่ Kori Care' },
  vi: { summary: 'Tóm tắt', source: 'Bài gốc',
        cta: 'Gặp vấn đề về visa, quyền lao động hay pháp lý ở Hàn Quốc? Hỏi chuyên gia.',
        btn: 'Kori Care Hỗ trợ 1:1', back: 'Quay lại Kori Care' }
};

function buildArticleHtml(newsItem, lang) {
  const dateStr = newsItem.date || new Date().toISOString().slice(0, 10);
  
  const t = NEWS_UI[lang] || NEWS_UI.en;

  const bannerHtml = `
    <div class="cta">
      <p class="cta-text">${escapeHtml(t.cta)}</p>
      <a href="https://www.koricare.kr" target="_blank" rel="noopener" class="cta-btn">${escapeHtml(t.btn)}</a>
    </div>
  `;

  // 예전에는 여기에 "영문 요약"이라며 newsItem.title 을 한 번 더 찍었다.
  // 태국·베트남 기사는 제목 자체가 그 나라 말이라, 화면 맨 위 h1 과 똑같은
  // 문장이 두 번 나올 뿐이었다. 없앤다.

  const heroImgTag = newsItem.image ? `<img src="${safeUrl(newsItem.image)}" alt="${escapeHtml(newsItem.title)}" style="width:100%; max-height:380px; object-fit:cover; border-radius:16px; margin: 18px 0 22px;">` : '';
  const backHref = lang === 'th' ? '../th/' : (lang === 'vi' ? '../vi/' : '../');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(newsItem.title)} — Kori Care News</title>
<meta name="description" content="${escapeHtml(newsItem.desc.slice(0, 150)).replace(/[\r\n]+/g, ' ')}">
<link rel="canonical" href="https://www.koricare.kr/link/news/${newsItem.id}.html">
<meta name="robots" content="noindex, follow">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YESCHJX46K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-YESCHJX46K');
</script>
<link rel="icon" type="image/png" href="https://www.koricare.kr/link/koricare_main_logo_nobg.png">
<style>
  :root { --bg: #f5f5f7; --card: #ffffff; --tint: #f1f5f9; --ink: #1d1d1f; --sub: #6e6e73; --navy: #002366; --line: #e2e8f0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  /* 각 기기의 기본 서체를 쓴다. 웹폰트를 받지 않으므로 첫 화면이 바로 그려지고,
     태국어·베트남어 글자도 세 OS 모두 기본 서체가 있어 깨지지 않는다. */
  body {
    background: var(--bg); color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI",
                 Roboto, "Noto Sans", "Noto Sans Thai", "Leelawadee UI", Arial, sans-serif;
    font-size: 16px; line-height: 1.7; letter-spacing: -0.003em;
    -webkit-font-smoothing: antialiased;
    padding-bottom: 48px;
  }
  .wrap { max-width: 720px; margin: 0 auto; padding: 0 16px; }
  a { text-decoration: none; color: inherit; }
  header { background: var(--navy); color: #fff; padding: 14px 0; box-shadow: 0 4px 20px rgba(0,35,102,0.15); }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-img { width: 34px; height: 34px; object-fit: contain; }
  .logo-text b { font-size: 18px; font-weight: 900; }
  .logo-text span { font-size: 9.5px; opacity: 0.85; text-transform: uppercase; font-weight: 700; }
  .post-card { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 28px 24px; margin-top: 24px; box-shadow: 0 6px 20px rgba(15,23,42,0.04); }
  .date-bar { font-size: 13px; color: var(--sub); font-weight: 500; margin-bottom: 10px; }
  h1 { font-size: 23px; font-weight: 700; letter-spacing: -0.02em; color: var(--navy); line-height: 1.35; margin-bottom: 12px; }

  /* 요약 — 이 페이지에서 사람이 실제로 읽는 부분이다.
     모델이 돌려준 마크다운을 목록으로 그려서 별표가 그대로 보이지 않게 한다. */
  .summary { margin-top: 22px; padding: 18px 20px; background: var(--tint); border-radius: 14px; }
  .summary-label {
    font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--sub); margin-bottom: 10px;
  }
  .summary p { font-size: 15.5px; line-height: 1.7; color: #1e293b; margin-bottom: 10px; }
  .summary p:last-child { margin-bottom: 0; }
  .summary .sum-list { margin: 0 0 4px; padding-left: 20px; }
  .summary .sum-list li { font-size: 15.5px; line-height: 1.65; color: #1e293b; margin-bottom: 9px; }
  .summary .sum-list li:last-child { margin-bottom: 0; }
  .summary .sum-list li::marker { color: #94a3b8; }
  .summary strong { font-weight: 650; color: var(--navy); }

  /* 코리케어의 시선.
     제목표를 붙이지 않는다. "Kori Care Feedback:" 같은 딱지가 붙는 순간
     읽는 사람은 광고로 본다. 요약 아래 한 문단으로 그냥 서 있게 두고,
     왼쪽 선과 글자 크기로만 구분한다. */
  .angle {
    margin: 22px 0 0;
    padding: 2px 0 2px 18px;
    border-left: 3px solid var(--navy);
    font-size: 17px;
    line-height: 1.66;
    letter-spacing: -0.008em;
    color: var(--ink);
  }

  /* 원문 표시는 작게. 글의 근거이지 읽을 거리가 아니다. */
  .src-note { margin-top: 22px; font-size: 12.5px; color: var(--sub); }
  .src-note a { color: var(--sub); text-decoration: underline; text-underline-offset: 3px; }
  .src-note a:hover { color: var(--navy); }

  /* 상담 안내 — 글씨를 굵게 하고 화살표를 붙일수록 광고처럼 보인다.
     한 번 읽고 지나가도 되는 자리라 담담하게 둔다. */
  .cta { margin: 28px 0 4px; padding: 20px; border-radius: 16px; background: var(--navy); text-align: center; }
  .cta-text { font-size: 13.5px; line-height: 1.55; color: #c7d6f0; margin-bottom: 14px; }
  .cta-btn {
    display: inline-block; padding: 10px 20px; border-radius: 999px;
    background: #ffffff; color: var(--navy);
    font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em;
    transition: background .15s ease;
  }
  .cta-btn:hover { background: #eef2fb; }

  .back-btn-minimal { display: flex; align-items: center; justify-content: center; font-size: 13.5px; font-weight: 600; color: #475569; background: #ffffff; border: 1px solid var(--line); padding: 13px; border-radius: 999px; margin-top: 20px; transition: all 0.2s; }
  .back-btn-minimal:hover { color: var(--navy); border-color: #c7d7f5; }

  @media (max-width: 600px) {
    .post-card { padding: 22px 18px; border-radius: 16px; }
    h1 { font-size: 20.5px; }
    .summary { padding: 16px; }
  }
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
    <h1>${escapeHtml(newsItem.title)}</h1>
    <hr style="border:none; border-top:1px solid #e2e8f0; margin:14px 0 20px;">
    ${heroImgTag}
    <section class="summary">
      <h2 class="summary-label">${escapeHtml(t.summary)}</h2>
      ${renderSummary(newsItem.desc, newsItem.title)}
    </section>

    ${newsItem.angle ? `<p class="angle">${escapeHtml(newsItem.angle)}</p>` : ''}

    <p class="src-note"><a href="${safeUrl(newsItem.link)}" target="_blank" rel="nofollow noopener">${escapeHtml(t.source)}</a></p>

    ${bannerHtml}
  </article>

  <a href="${backHref}" class="back-btn-minimal">${escapeHtml(t.back)}</a>
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
      const thumb = safeUrl(rawThumb);
      const title = escapeHtml(item.title);
      const href = escapeHtml(`/link/news/${item.id}.html`);
      const dateStr = item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

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

// 한 번 돌 때 언어별로 요약할 최대 건수.
//
// 예전에는 상한이 없었다. 영어를 먼저 다 돌리다 하루 할당량을 태우고,
// 태국어·베트남어 차례에는 남은 것이 없어 요약이 통째로 실패했다.
// 실측: 영어 174건 중 21건(12%), 태국어 642건 중 3건, 베트남어 1,203건 중 4건.
// 나머지는 RSS 원문 한 줄이 그대로 화면에 나갔다.
// 언어마다 몫을 정해 두면 세 언어가 고르게 요약된다.
const SUMMARY_LIMIT_PER_LANG = GEMINI.LIMIT_PER_LANG;

async function runPipeline() {
  console.log('🚀 3대 언론사 멀티 교차 파싱 파이프라인 집행...');
  let summarized = 0, summarizeFailed = 0, summarizeSkipped = 0, notTranslated = 0, archived = 0, skippedNotShown = 0, angled = 0;

  for (const lang of ['en', 'th', 'vi']) {
    let summarizedThisLang = 0;
    let combinedItems = [];
    for (const feedUrl of RSS_FEEDS[lang]) {
      const xml = await fetchUrl(feedUrl);
      const items = parseXmlItems(xml);
      // 어느 매체에서 왔는지 달아 둔다. 교차검증에 쓴다.
      const source = new URL(feedUrl).hostname.replace(/^www\./, '');
      for (const it of items) it.source = source;
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

    const withId = uniqueItems.map((item) => {
      const hash = crypto.createHash('md5').update(item.link || item.title).digest('hex').slice(0,8);
      item.id = `hotnews_${lang}_${hash}`;
      return item;
    });

    // 목록에 들어갈 것만 만든다.
    //
    // 예전에는 RSS 로 들어온 것을 전부 HTML 로 만들었다. 목록은 50건만
    // 유지하는데 하루 수백 장이 생기니, 아무 데서도 갈 수 없는 파일이 쌓였다.
    // 실측 2026-09-01: 2,326장 중 2,176장(94%)이 고아, 14.4MB.
    // 베트남어는 하루 454장을 만들어 50장만 쓰고 있었다.
    //
    // 그래서 먼저 기존 목록과 합쳐 상위 50건을 정한 뒤,
    // 그 안에 든 새 기사만 요약하고 파일로 만든다.
    const tsOfItem = (x) => x.ts || Date.parse((x.date || '') + 'T00:00:00Z') || 0;
    const existingLinks = new Set(existingList.map(x => x.link));
    const merged = [...existingList, ...withId.filter(x => !existingLinks.has(x.link))]
      .sort((a, b) => tsOfItem(b) - tsOfItem(a))
      .slice(0, 50);
    const willShow = new Set(merged.map(x => x.link));

    // 처리 몫이 언어당 10건이므로 순서가 중요하다.
    //   ① 여러 매체가 함께 다루는 것 — 그날 실제로 큰 사건이라는 뜻
    //   ② 우리 독자에게 걸리는 주제
    //   ③ 최신
    const candidates = clusterStories(
      withId.filter(x => !existingLinks.has(x.link) && willShow.has(x.link)));

    const newItemsList = candidates.sort((a, b) =>
      (b.coverage - a.coverage) ||
      (topicScore(b) - topicScore(a)) ||
      ((b.ts || 0) - (a.ts || 0)));

    skippedNotShown += withId.filter(x => !existingLinks.has(x.link) && !willShow.has(x.link)).length;

    const needsTranslation = NEEDS_TRANSLATION[lang];

    for (const item of newItemsList) {
      if (!existingList.find(x => x.link === item.link)) {

        // 번역이 제목을 덮어쓰기 전에 영어 원문 제목을 남겨 둔다.
        // 갈래 판정을 번역본으로 하면 언어마다 결과가 달라진다.
        const sourceTitle = item.title;
        let fullText = item.desc;
        if (process.env.GEMINI_API_KEY && summarizedThisLang >= SUMMARY_LIMIT_PER_LANG) {
          summarizeSkipped++;
        } else if (process.env.GEMINI_API_KEY) {
          try {
            const htmlContent = await fetchUrl(item.link);
            // script·style 을 먼저 걷어낸다. 이걸 안 하면 태국 thairath 처럼
            // <p> 안에 CSS 가 통째로 들어와 요약 대상이 코드가 된다 (실측 32,531자 중 앞부분 전부 CSS).
            const articleHtml = htmlContent
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '');
            const pMatches = articleHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
            if (pMatches && pMatches.length > 0) {
              const extracted = pMatches
                .map(p => cleanText(p))
                // 40자 미만은 내비게이션·버튼 문구, 중괄호가 있으면 남은 CSS 조각이다.
                .filter(t => t.length >= 40 && !/[{}]/.test(t))
                .join('\n').trim();
              if (extracted.length > 200) {
                 fullText = extracted.slice(0, 4000);
              }
            }
            
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            // 호출 사이를 띄운다. 쉬지 않고 던지면 분당 한도에 걸려
            // 앞의 스무 건만 통과하고 나머지가 전부 튕긴다.
            if (summarized > 0) await delay(GEMINI.CALL_INTERVAL_MS);

            if (needsTranslation) {
              // 원문이 영어다. 제목과 본문을 함께 그 나라 말로 옮긴다.
              const out = await translateAndSummarize(ai, fullText, item.title, needsTranslation);
              item.title = out.title;
              item.desc = out.summary;
              item.translated = true;

              // 코리케어의 시선. 그 나라 말로 바로 쓴다 — 영어로 쓰고 옮기면
              // 호출이 한 번 더 들고 문장이 번역투가 된다.
              await delay(GEMINI.CALL_INTERVAL_MS);
              item.angle = await writeAngle(ai, { title: sourceTitle, desc: fullText }, needsTranslation);
              if (item.angle) angled++;
            } else {
              const prompt =
                `Summarize the news article below in exactly 3 bullet points, in English.\n\n` +
                `Rules:\n` +
                `- Output ONLY the 3 bullets. No preamble, no heading, no closing remark.\n` +
                `- Start each line with "- ".\n` +
                `- One fact per bullet. Plain words. 1 to 2 sentences each.\n` +
                `- Do not invent anything that is not in the text.\n\n` +
                `Article:\n${fullText}`;
              const text = await summarizeOnce(ai, prompt);
              if (!text) throw new Error('빈 요약');
              item.desc = stripPreamble(text);

              await delay(GEMINI.CALL_INTERVAL_MS);
              item.angle = await writeAngle(ai, { title: sourceTitle, desc: fullText }, 'English');
              if (item.angle) angled++;
            }
            summarized++;
            summarizedThisLang++;
          } catch (e) {
            summarizeFailed++;
            console.error('[요약 실패] ' + item.title + ' — ' + (e && e.message ? e.message : e));
          }
        }

        // 번역이 필요한 언어인데 번역이 안 된 기사는 내보내지 않는다.
        // 영어 제목과 영어 본문이 태국어 페이지에 그대로 뜨면
        // 지금보다 나빠진다. 다음 회차에 다시 시도한다.
        if (needsTranslation && !item.translated) {
          notTranslated++;
          continue;
        }

        const html = buildArticleHtml(item, lang);
        fs.writeFileSync(path.join(NEWS_DIR, `${item.id}.html`), html, 'utf-8');
        existingList.push({ id: item.id, date: item.date, ts: item.ts, image: item.image, title: item.title, link: item.link });

        // 월간 정리용으로 따로 쌓아 둔다.
        // 뉴스 HTML 은 3일이면 지워지므로, 한 달치를 모으려면 이 보관 파일이 있어야 한다.
        // 갈래 판정은 번역 전 영어 제목으로 한다 — 언어마다 갈래가 달라지면 안 된다.
        if (newsArchive.add(lang, item, sourceTitle)) archived++;
      }
    }

    // 발행 시각 내림차순 정렬. 예전에는 최신순 루프 안에서 unshift를 돌려
    // 배치에서 가장 오래된 기사가 맨 앞으로 가고, 최신 기사는 뒤로 밀려
    // slice(0,50)에서 잘려나갔다.
    const tsOf = (x) => x.ts || Date.parse(x.date + 'T00:00:00Z') || 0;
    existingList.sort((a, b) => tsOf(b) - tsOf(a));

    // Rolling retention (keep 50)
    const keptList = existingList.slice(0, 50);
    const removedList = existingList.slice(50);

    // 오래된 HTML은 clean_old_news.js가 날짜 기준으로 정리한다.

    fs.writeFileSync(dataPath, JSON.stringify(keptList, null, 2), 'utf-8');
    const newsList = keptList;

    const targetIndexPath = lang === 'en' ? INDEX_EN_PATH : (lang === 'th' ? INDEX_TH_PATH : INDEX_VI_PATH);
    const langPrefix = lang === 'en' ? '' : '../';
    injectGridCardsToIndex(targetIndexPath, newsList, langPrefix);
  }

  console.log('🎉 3대 언론사 교차 파싱 완료!');
  console.log(`요약 성공 ${summarized}건 · 실패 ${summarizeFailed}건 · 상한 초과로 건너뜀 ${summarizeSkipped}건`);
  console.log(`코리케어 시선이 붙은 기사 ${angled}건 / 요약 ${summarized}건`);
  console.log(`월간 정리용으로 보관 ${archived}건`);
  if (skippedNotShown) console.log(`목록(50건)에 못 드는 기사 ${skippedNotShown}건은 만들지 않았다`);
  if (notTranslated) {
    console.log(`번역이 안 되어 내보내지 않은 기사 ${notTranslated}건 (다음 회차에 다시 시도한다)`);
  }

  // 전건 실패일 때만 작업을 실패로 표시한다.
  // 한 건 실패마다 멈추면 기사 하나 때문에 갱신 전체가 안 올라간다.
  if (process.env.GEMINI_API_KEY && summarized === 0 && summarizeFailed > 0) {
    console.error('요약이 한 건도 되지 않았다. API 키·모델명·할당량을 확인할 것.');
    process.exit(1);
  }
}

runPipeline();
