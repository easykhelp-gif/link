// 월간 요약 뉴스 — 한 달치 기사를 세 갈래로 묶고, 갈래마다 우리가 쓴 글을 얹는다.
//
// 왜 이 페이지만 검색에 여는가
//   개별 뉴스 페이지는 남의 기사 요약이다. 수천 장을 검색에 열면
//   구글이 "대량 복제"로 본다. 그래서 개별 페이지는 noindex 로 둔다.
//   이 페이지가 다른 점은 갈래마다 붙는 종합 문단이다.
//   "이런 일들이 있었고, 그래서 이렇게 대비해야 한다" — 원문 어디에도 없는 글이다.
//   그 문단이 이 페이지를 우리 것으로 만든다. 연 12장 × 3언어라 양도 문제없다.
//
// 만들어지는 것
//   {lang}/news/monthly/{YYYY-MM}/index.html      · index 대상, 사이트맵 등록
//
//   node build_monthly_digest.js              지난달
//   node build_monthly_digest.js 2026-08      특정 달
//   node build_monthly_digest.js 2026-08 --dry   무엇이 실릴지만 본다

const fs = require('fs');
const path = require('path');
const GEMINI = require('./gemini_config');
const newsArchive = require('./news_archive');

const BASE = __dirname;
const NEWS_DIR = path.join(BASE, 'news');
const dry = process.argv.includes('--dry');

const argMonth = process.argv.slice(2).find(a => /^\d{4}-\d{2}$/.test(a));
const MONTH = argMonth || (() => {
  const d = new Date();
  d.setDate(1); d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
})();

// 갈래마다 이만큼은 있어야 종합 문단을 쓸 값어치가 있다
const MIN_PER_SECTION = 2;
// 페이지 전체가 이보다 적으면 만들지 않는다.
// 빈 페이지나 두어 줄짜리를 검색에 여는 것은 아무것도 안 여는 것보다 나쁘다.
const MIN_TOTAL = 4;
// 한 갈래에 너무 많이 실으면 목록이 된다
const MAX_PER_SECTION = 6;

// 세 갈래(사건사고 · 한국 생활과 제도 · 연예와 문화)의 정의는
// news_archive.js 한 곳에서만 갖는다. 두 곳에 두면 어긋난다.
const SECTIONS = newsArchive.SECTIONS;

// ── 화면 문구 ─────────────────────────────────────────────────
const LABEL = {
  en: {
    title: 'Korea this month, for people living here',
    kicker: 'Monthly news digest',
    intro: 'What happened in Korea last month, grouped into three parts, with what each part means if you live here on a foreign passport.',
    section: { incident: 'Accidents and crime', living: 'Life and rules in Korea', culture: 'Entertainment and culture' },
    source: 'Source', back: 'Back to Kori Care', guides: 'Guides on this',
    note: 'Kori Care selects and explains. Original reporting belongs to the outlets linked under each item.'
  },
  th: {
    title: 'เกาหลีเดือนนี้ สำหรับคนที่อาศัยอยู่ที่นี่',
    kicker: 'สรุปข่าวรายเดือน',
    intro: 'สิ่งที่เกิดขึ้นในเกาหลีเมื่อเดือนที่แล้ว แบ่งเป็นสามส่วน พร้อมความหมายของแต่ละส่วนสำหรับผู้ที่อาศัยในเกาหลีด้วยหนังสือเดินทางต่างชาติ',
    section: { incident: 'อุบัติเหตุและอาชญากรรม', living: 'ชีวิตและกฎระเบียบในเกาหลี', culture: 'บันเทิงและวัฒนธรรม' },
    source: 'ที่มา', back: 'กลับสู่ Kori Care', guides: 'คู่มือเรื่องนี้',
    note: 'Kori Care เป็นผู้คัดเลือกและอธิบาย ข่าวต้นฉบับเป็นของสำนักข่าวที่ลิงก์ไว้ใต้แต่ละรายการ'
  },
  vi: {
    title: 'Hàn Quốc tháng này, cho người đang sống ở đây',
    kicker: 'Tổng hợp tin tức hàng tháng',
    intro: 'Những gì đã xảy ra ở Hàn Quốc tháng trước, chia thành ba phần, kèm ý nghĩa của mỗi phần với người sống tại đây bằng hộ chiếu nước ngoài.',
    section: { incident: 'Tai nạn và tội phạm', living: 'Đời sống và quy định ở Hàn Quốc', culture: 'Giải trí và văn hóa' },
    source: 'Nguồn', back: 'Quay lại Kori Care', guides: 'Hướng dẫn liên quan',
    note: 'Kori Care chọn lọc và giải thích. Bài gốc thuộc về các hãng tin được dẫn link dưới mỗi mục.'
  }
};

const LANG_NAME = { en: 'English', th: 'Thai', vi: 'Vietnamese' };

// 갈래별로 연결할 가이드
const GUIDE_FOR = {
  incident: [{ cat: 'safety', id: 'scam_prevention_bank_sim' }, { cat: 'korea', id: 'industrial_accident' }],
  living:   [{ cat: 'korea', id: 'hospital_seoul' }, { cat: 'korea', id: 'severance_pay' }],
  culture:  []
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 기사 모으기 ───────────────────────────────────────────────
// 뉴스 HTML 은 3일이면 지워지므로 거기서 한 달치를 모을 수 없다.
// auto_fetch_news.js 가 쌓아 둔 보관 파일(news_archive)에서 읽는다.
function collect(lang) {
  return newsArchive.ofMonth(lang, MONTH)
    .map(x => ({ ...x, key: x.section }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ── 우리가 쓰는 글 ────────────────────────────────────────────
// 갈래마다 한 문단. 기사 하나하나가 아니라 그 달 전체를 놓고 쓴다.
// 항목마다 해설을 붙이면 되풀이가 되고, 문맥이 좁아 엉뚱한 말이 나오기 쉽다.
const SECTION_BRIEF = {
  incident: 'what happened, what the pattern is, and exactly what a foreign resident should do differently because of it',
  living:   'what changed in rules, prices or public services, and exactly what a foreign resident should check, file or prepare',
  culture:  'what was notable, and what is worth knowing or joining for someone living in Korea'
};

async function writeSection(ai, items, key, lang) {
  const langName = LANG_NAME[lang];
  const list = items.map((it, i) =>
    `${i + 1}. ${it.title}\n${it.bullets.map(b => '   - ' + b).join('\n')}`).join('\n\n');

  const prompt =
    `You write for Kori Care, a guide site for people living in South Korea on a foreign passport ` +
    `— mostly workers, students and spouses from Thailand, Vietnam and elsewhere.\n\n` +
    `Below are the news items from one month in the category "${key}".\n\n${list}\n\n` +
    `Write one paragraph in ${langName} covering ${SECTION_BRIEF[key]}.\n\n` +
    `Rules:\n` +
    `- 3 to 5 sentences. One paragraph. No heading, no bullet list, no preamble.\n` +
    `- Write about these items only. Do not add facts that are not above.\n` +
    `- Say what the reader should do, in plain words. Name the number, date or amount when the items give one.\n` +
    `- Do not exaggerate and do not frighten. Do not tell the reader to avoid seeking help.\n` +
    `- If these items genuinely give a reader nothing to act on, reply with exactly: SKIP\n`;

  await new Promise(r => setTimeout(r, GEMINI.CALL_INTERVAL_MS));
  const res = await ai.models.generateContent({ model: GEMINI.MODEL, contents: prompt });
  const t = String((res && res.text) || '').trim()
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(here is|below is)[^\n:]*:\s*/i, '');
  if (!t || /^SKIP$/i.test(t) || t.length < 60) return '';
  return t;
}

// 한 달 전체를 여는 짧은 글
async function writeLede(ai, sections, lang) {
  const langName = LANG_NAME[lang];
  const body = sections.map(s => `[${s.key}] ${s.brief}`).join('\n\n');
  const prompt =
    `You write for Kori Care, a guide site for people living in South Korea on a foreign passport.\n\n` +
    `These are this month's section summaries:\n\n${body}\n\n` +
    `Write two sentences in ${langName} that open the page: what this month was about for someone ` +
    `living in Korea, and what to pay attention to.\n` +
    `Rules: two sentences, no heading, no preamble, no quotation marks. ` +
    `Use only what is above.\n`;

  await new Promise(r => setTimeout(r, GEMINI.CALL_INTERVAL_MS));
  const res = await ai.models.generateContent({ model: GEMINI.MODEL, contents: prompt });
  const t = String((res && res.text) || '').trim().replace(/^["'\s]+|["'\s]+$/g, '');
  return (!t || /^SKIP$/i.test(t)) ? '' : t;
}

// ── 페이지 ────────────────────────────────────────────────────
function buildPage(lang, monthName, lede, sections) {
  const L = LABEL[lang];
  const canon = (l) => `https://www.koricare.kr/link/${l}/news/monthly/${MONTH}/`;
  const homeUrl = lang === 'en' ? '/link/index.html' : `/link/${lang}/index.html`;

  const body = sections.map(s => {
    const cards = s.items.map(it => `
        <article class="item">
          <h3>${esc(it.title)}</h3>
          <ul>${it.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
          ${it.link ? `<a class="src" href="${esc(it.link)}" target="_blank" rel="nofollow noopener">${esc(L.source)}</a>` : ''}
        </article>`).join('');

    const guides = GUIDE_FOR[s.key] || [];
    const guideHtml = guides.length ? `
        <p class="guides">${esc(L.guides)} ·
          ${guides.map(g => `<a href="/link/${lang}/guides/${g.cat}/${g.id}/">${g.id.replace(/_/g, ' ')}</a>`).join(' · ')}
        </p>` : '';

    return `<section class="sec">
        <h2 id="${s.key}">${esc(L.section[s.key])}</h2>
        <p class="brief">${esc(s.brief)}</p>
        ${guideHtml}
        <div class="items">${cards}</div>
      </section>`;
  }).join('');

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'Article',
      '@id': canon(lang) + '#article',
      headline: `${L.title} — ${monthName}`,
      description: (lede || L.intro).slice(0, 200),
      datePublished: `${MONTH}-01T00:00:00+09:00`,
      dateModified: new Date().toISOString().slice(0, 10) + 'T00:00:00+09:00',
      inLanguage: lang,
      isAccessibleForFree: true,
      articleSection: sections.map(s => L.section[s.key]),
      mainEntityOfPage: { '@type': 'WebPage', '@id': canon(lang) },
      author: { '@type': 'Organization', name: 'Kori Care', url: 'https://www.koricare.kr' },
      publisher: {
        '@type': 'Organization', name: 'Kori Care', url: 'https://www.koricare.kr',
        logo: { '@type': 'ImageObject', url: 'https://www.koricare.kr/link/koricare_main_logo_nobg.png' }
      }
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Kori Care', item: 'https://www.koricare.kr' + homeUrl },
        { '@type': 'ListItem', position: 2, name: L.title, item: canon(lang) }
      ]
    }]
  }, null, 2).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(L.title)} — ${esc(monthName)} | Kori Care</title>
<link rel="canonical" href="${canon(lang)}">
<link rel="alternate" hreflang="x-default" href="${canon('en')}">
<link rel="alternate" hreflang="en" href="${canon('en')}">
<link rel="alternate" hreflang="th" href="${canon('th')}">
<link rel="alternate" hreflang="vi" href="${canon('vi')}">
<meta name="description" content="${esc((lede || L.intro).slice(0, 155))}">
<meta name="robots" content="index, follow, max-snippet:-1">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Kori Care">
<meta property="og:title" content="${esc(L.title)} — ${esc(monthName)}">
<meta property="og:description" content="${esc((lede || L.intro).slice(0, 155))}">
<meta property="og:url" content="${canon(lang)}">
<script type="application/ld+json">
${schema}
</script>
<style>
  :root{--bg:#fff;--tint:#f5f5f7;--ink:#1d1d1f;--sub:#6e6e73;--line:rgba(0,0,0,.10);--navy:#002366;--navy-l:#1e40af}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,"Noto Sans","Noto Sans Thai","Leelawadee UI",Arial,sans-serif;
    font-size:17px;line-height:1.62;letter-spacing:-.003em;-webkit-font-smoothing:antialiased;padding-bottom:56px}
  .wrap{max-width:700px;margin:0 auto;padding:0 20px}
  a{color:inherit;text-decoration:none}
  header{position:sticky;top:0;z-index:10;background:rgba(0,35,102,.92);
    -webkit-backdrop-filter:saturate(180%) blur(16px);backdrop-filter:saturate(180%) blur(16px);color:#fff}
  .hrow{display:flex;align-items:center;min-height:52px;padding:8px 20px;max-width:700px;margin:0 auto}
  .hrow b{font-size:17px;font-weight:700;letter-spacing:-.02em}
  .kicker{font-size:12.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub);margin-top:24px}
  h1{font-size:30px;line-height:1.18;font-weight:700;letter-spacing:-.024em;margin:8px 0 14px;text-wrap:balance}
  .lede{font-size:19px;line-height:1.55;color:var(--sub);letter-spacing:-.011em;padding-bottom:22px;border-bottom:1px solid var(--line)}
  .sec{margin-top:40px}
  .sec h2{font-size:24px;font-weight:700;letter-spacing:-.019em;margin-bottom:12px;scroll-margin-top:70px}
  /* 갈래마다 붙는 우리 글. 이 페이지에서 사람이 먼저 읽는 부분이다. */
  .brief{font-size:17px;line-height:1.68;margin-bottom:14px}
  .guides{font-size:14px;color:var(--sub);margin-bottom:18px}
  .guides a{color:var(--navy-l);font-weight:500;box-shadow:inset 0 -1px 0 rgba(30,64,175,.3);text-transform:capitalize}
  .items{display:flex;flex-direction:column;gap:10px}
  .item{padding:16px 18px;background:var(--tint);border-radius:14px}
  .item h3{font-size:16.5px;font-weight:650;line-height:1.35;margin-bottom:8px}
  .item ul{margin:0;padding-left:19px}
  .item li{font-size:15px;line-height:1.6;color:#1e293b;margin-bottom:6px}
  .item li:last-child{margin-bottom:0}
  .item li::marker{color:#94a3b8}
  .src{display:inline-block;margin-top:9px;font-size:12.5px;color:var(--sub);text-decoration:underline;text-underline-offset:3px}
  .note{margin-top:40px;padding:16px 18px;background:var(--tint);border-radius:12px;font-size:13.5px;line-height:1.6;color:var(--sub)}
  .back{display:inline-flex;align-items:center;margin-top:28px;padding:13px 24px;border-radius:999px;background:var(--navy);color:#fff;font-size:15px;font-weight:600}
  footer{margin-top:34px;padding-top:20px;border-top:1px solid var(--line);color:var(--sub);font-size:12.5px}
  @media(max-width:600px){body{font-size:16.5px}h1{font-size:25px}.lede{font-size:17.5px}.sec h2{font-size:21px}.brief{font-size:16.5px}}
</style>
</head>
<body>
<header><div class="hrow"><a href="${homeUrl}"><b>Kori Care</b></a></div></header>
<main class="wrap">
  <p class="kicker">${esc(L.kicker)} · ${esc(monthName)}</p>
  <h1>${esc(L.title)}</h1>
  <p class="lede">${esc(lede || L.intro)}</p>
  ${body}
  <p class="note">${esc(L.note)}</p>
  <a href="${homeUrl}" class="back">${esc(L.back)}</a>
  <footer>© 2026 Kori Care</footer>
</main>
</body>
</html>`;
}

// ── 실행 ──────────────────────────────────────────────────────
(async () => {
  const [y, mo] = MONTH.split('-');
  const made = [];

  for (const lang of ['en', 'th', 'vi']) {
    const all = collect(lang);
    const grouped = SECTIONS
      .map(s => ({ key: s.key, items: all.filter(i => i.key === s.key).slice(0, MAX_PER_SECTION) }))
      .filter(s => s.items.length >= MIN_PER_SECTION);
    const total = grouped.reduce((n, s) => n + s.items.length, 0);

    console.log(`  [${lang}] 요약 있는 기사 ${all.length}건 → ` +
      grouped.map(s => s.key + ' ' + s.items.length).join(', ') + (grouped.length ? '' : '(갈래 없음)'));

    const dir = path.join(BASE, lang, 'news', 'monthly', MONTH);

    if (total < MIN_TOTAL) {
      console.log(`        ${total}건 — ${MIN_TOTAL}건 미만이라 페이지를 만들지 않는다`);
      if (!dry && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      continue;
    }
    if (dry) { console.log('        (미리보기 — 종합 문단은 실제 실행 때 쓴다)'); continue; }

    if (!process.env.GEMINI_API_KEY) {
      console.log('        GEMINI_API_KEY 가 없어 종합 문단을 쓸 수 없다. 페이지를 만들지 않는다.');
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      continue;
    }

    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 갈래마다 우리 글을 쓴다. 못 쓴 갈래는 통째로 뺀다.
    const written = [];
    for (const s of grouped) {
      try {
        const brief = await writeSection(ai, s.items, s.key, lang);
        if (brief) written.push({ ...s, brief });
        else console.log(`        [${s.key}] 종합 문단 없음 — 이 갈래를 뺀다`);
      } catch (e) {
        console.error(`        [${s.key}] 종합 문단 실패 — ${e && e.message ? e.message : e}`);
      }
    }
    const finalTotal = written.reduce((n, s) => n + s.items.length, 0);
    if (!written.length || finalTotal < MIN_TOTAL) {
      console.log('        우리 글이 붙은 갈래가 부족하다. 페이지를 만들지 않는다.');
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      continue;
    }

    let lede = '';
    try { lede = await writeLede(ai, written, lang); } catch (e) { /* 없으면 기본 문구 */ }

    const monthName = new Date(+y, +mo - 1, 1).toLocaleDateString(
      lang === 'en' ? 'en-GB' : (lang === 'th' ? 'th-TH' : 'vi-VN'), { year: 'numeric', month: 'long' });

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), buildPage(lang, monthName, lede, written), 'utf8');
    made.push(`https://www.koricare.kr/link/${lang}/news/monthly/${MONTH}/`);
    console.log(`        페이지 생성 · 갈래 ${written.length}개 · 기사 ${finalTotal}건`);
  }

  // 사이트맵 — 실제로 만든 것만 넣고, 안 만든 것은 뺀다
  if (!dry) {
    const sp = path.join(BASE, 'sitemap.xml');
    if (fs.existsSync(sp)) {
      let xml = fs.readFileSync(sp, 'utf8');
      for (const lang of ['en', 'th', 'vi']) {
        const url = `https://www.koricare.kr/link/${lang}/news/monthly/${MONTH}/`;
        const has = made.includes(url);
        const already = xml.indexOf(url) >= 0;
        if (has && !already) {
          xml = xml.replace('</urlset>',
            `  <url>\n    <loc>${url}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n</urlset>`);
        } else if (!has && already) {
          xml = xml.replace(new RegExp('  <url>\\n    <loc>' +
            url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '<\\/loc>[\\s\\S]*?<\\/url>\\n'), '');
        }
      }
      fs.writeFileSync(sp, xml, 'utf8');
    }
  }

  console.log((dry ? '[미리보기] ' : '') + MONTH + ' — 페이지 ' + made.length + '장');
  console.log('  개별 뉴스는 noindex 그대로. 검색에 여는 것은 이 페이지뿐이다.');
})();
