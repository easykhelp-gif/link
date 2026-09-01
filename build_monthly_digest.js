// 한 달 동안 모인 뉴스 중 재한 외국인에게 걸리는 것을 골라 한 장으로 묶는다.
//
// 왜 이것만 검색에 여는가
//   개별 뉴스 페이지는 남의 기사 요약이다. 수천 장을 검색에 열면
//   구글이 "대량 복제"로 본다. 그래서 개별 페이지는 noindex 로 둔다.
//   이 페이지는 다르다. 한 달치에서 우리가 고르고, 왜 중요한지 붙이고,
//   해당 가이드로 연결한다. 연 12장이라 양으로 문제될 것도 없다.
//
// 만들어지는 것
//   {lang}/news/monthly/{YYYY-MM}/index.html      · index 대상
//   사이트맵에 등록
//
//   node build_monthly_digest.js            지난달치
//   node build_monthly_digest.js 2026-09    특정 달
//   node build_monthly_digest.js --dry

const fs = require('fs');
const path = require('path');
const GEMINI = require('./gemini_config');

const BASE = __dirname;
const DATA_DIR = path.join(BASE, 'data');
const NEWS_DIR = path.join(BASE, 'news');
const dry = process.argv.includes('--dry');

// 이 수보다 적으면 페이지를 만들지 않는다.
// 항목 한두 개짜리 페이지를 검색에 열면 "쓸 것 없는 페이지"로 판정된다.
// 빈 페이지를 노출하느니 그 달은 없는 편이 낫다.
const MIN_ITEMS = 3;

const argMonth = process.argv.slice(2).find(a => /^\d{4}-\d{2}$/.test(a));
const MONTH = argMonth || (() => {
  const d = new Date();
  d.setDate(1); d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
})();

// 무엇을 싣는가
//
// 이 페이지는 검색에 여는 유일한 페이지다. 애매한 기사가 한 건이라도
// 실리면 페이지 전체의 값이 떨어진다. 그래서 두 단계로 거른다.
//
//   강한 말   그 말만 있어도 재한 외국인에게 직접 걸린다
//   약한 말   외국인·이주 관련 표시가 같이 있을 때만 싣는다
//
// 예전에 "반도체 세수 162조" 가 'tax' 하나에 걸려 "돈·사기" 에 실렸다.
// 약한 말만으로 싣지 않는 이유다.
const FOREIGN_SIGNAL = /foreign(er|ers|ｎational)?|migrant|multicultural|expat|immigrant|E-9|EPS|alien registration|ต่างชาติ|แรงงานข้ามชาติ|người nước ngoài|lao động nước ngoài|nhập cư/i;

const TOPICS = [
  { key: 'visa', weight: 10,
    strong: /visa|immigration (office|policy|rule|law)|alien registration|sojourn|residence (permit|status|card)|employment permit system|work permit|E-9|EPS|deportation|วีซ่า|ตรวจคนเข้าเมือง|thị thực|xuất nhập cảnh|giấy phép cư trú/i,
    weak:   /residence|immigration|permit|cư trú/i },
  { key: 'work', weight: 9,
    strong: /minimum wage|severance pay|industrial accident|workplace (safety|death|accident)|unpaid wage|wage arrears|labor standards act|ค่าแรงขั้นต่ำ|เงินชดเชย|lương tối thiểu|tiền thôi việc|tai nạn lao động/i,
    weak:   /labor|labour|wage|employment|worker|แรงงาน|lao động/i },
  { key: 'health', weight: 8,
    strong: /health insurance|NHIS|national pension|medical (support|cost|fee)|emergency room|ประกันสุขภาพแห่งชาติ|bảo hiểm y tế quốc gia/i,
    weak:   /medical|hospital|health|pension|clinic|โรงพยาบาล|bệnh viện/i },
  { key: 'money', weight: 7,
    strong: /voice phishing|scam|fraud|identity theft|remittance|jeonse (fraud|scam)|มิจฉาชีพ|หลอกลวง|lừa đảo|chuyển tiền/i,
    weak:   /tax|deposit|rent|housing|bank|exchange rate|ภาษี|thuế/i },
  { key: 'life', weight: 5,
    strong: /multicultural (family|policy|center)|global (center|village)|support center for foreign|ศูนย์ช่วยเหลือชาวต่างชาติ|trung tâm hỗ trợ người nước ngoài/i,
    weak:   /festival|holiday|typhoon|heat wave|subway|transport|เทศกาล|lễ hội/i }
];

// 기사 하나가 어느 주제에 속하는지 정한다. 어디에도 안 걸리면 싣지 않는다.
function classify(text) {
  const hasSignal = FOREIGN_SIGNAL.test(text);
  let best = null;
  for (const t of TOPICS) {
    const hit = t.strong.test(text) || (hasSignal && t.weak.test(text));
    if (hit && (!best || t.weight > best.weight)) best = t;
  }
  return best;
}

const LABEL = {
  en: { title: 'What changed for foreign residents in Korea',
        intro: 'A monthly round-up of the rules, prices and public services that affect people living in Korea on a foreign passport. We pick the items that change what you can do, and say what each one means in practice.',
        topic: { visa: 'Visa and residence', work: 'Work and pay', health: 'Health and insurance', money: 'Money and scams', life: 'Daily life' },
        source: 'Source', guides: 'Related guides', back: 'Back to Kori Care',
        means: 'What this means for you — ',
        empty: 'Nothing in this period changed the rules for foreign residents.' },
  th: { title: 'สิ่งที่เปลี่ยนไปสำหรับชาวต่างชาติในเกาหลี',
        intro: 'สรุปรายเดือนของกฎ ค่าใช้จ่าย และบริการสาธารณะที่มีผลต่อผู้ที่อาศัยในเกาหลีด้วยหนังสือเดินทางต่างชาติ เราคัดเฉพาะเรื่องที่เปลี่ยนสิ่งที่คุณทำได้ และอธิบายว่าแต่ละเรื่องหมายถึงอะไรในทางปฏิบัติ',
        topic: { visa: 'วีซ่าและการพำนัก', work: 'การทำงานและค่าจ้าง', health: 'สุขภาพและประกัน', money: 'เงินและมิจฉาชีพ', life: 'ชีวิตประจำวัน' },
        source: 'ที่มา', guides: 'คู่มือที่เกี่ยวข้อง', back: 'กลับสู่ Kori Care',
        means: 'สิ่งนี้หมายถึงอะไรสำหรับคุณ — ',
        empty: 'ในช่วงนี้ไม่มีการเปลี่ยนแปลงกฎที่มีผลต่อชาวต่างชาติ' },
  vi: { title: 'Những thay đổi với người nước ngoài tại Hàn Quốc',
        intro: 'Tổng hợp hàng tháng về các quy định, chi phí và dịch vụ công ảnh hưởng đến người sống tại Hàn Quốc bằng hộ chiếu nước ngoài. Chúng tôi chọn những mục làm thay đổi điều bạn có thể làm, và nói rõ mỗi mục có ý nghĩa gì trên thực tế.',
        topic: { visa: 'Visa và cư trú', work: 'Việc làm và tiền lương', health: 'Sức khỏe và bảo hiểm', money: 'Tiền bạc và lừa đảo', life: 'Đời sống' },
        source: 'Nguồn', guides: 'Hướng dẫn liên quan', back: 'Quay lại Kori Care',
        means: 'Điều này có nghĩa gì với bạn — ',
        empty: 'Trong kỳ này không có thay đổi quy định nào với người nước ngoài.' }
};

// 주제별로 연결할 가이드
const GUIDE_FOR = {
  visa:   [{ cat: 'korea', id: 'departure_insurance' }],
  work:   [{ cat: 'korea', id: 'severance_pay' }, { cat: 'korea', id: 'industrial_accident' }],
  health: [{ cat: 'korea', id: 'hospital_seoul' }, { cat: 'korea', id: 'guide_hospital_pharmacy' }],
  money:  [{ cat: 'safety', id: 'scam_prevention_bank_sim' }],
  life:   [{ cat: 'korea', id: 'hospital_seoul' }]
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 이 페이지를 우리 글로 만드는 층 ─────────────────────────────
//
// 뉴스 요약만 모아 두면 남의 기사 모음이다. 검색엔진도 사람도 그렇게 본다.
// 각 항목에 "그래서 한국 사는 당신에게 무슨 일이 생기는가" 한 줄을 붙인다.
// 그 한 줄이 원문에 없는 것이고, 우리가 만든 것이다.
//
// 이 줄을 못 만들면 그 항목은 싣지 않는다. 붙이겠다고 써 놓고
// 안 붙은 페이지가 나가는 일이 없게 한다.

const MEANING_PROMPT = {
  en: 'English', th: 'Thai', vi: 'Vietnamese'
};

async function addMeaning(items, lang) {
  if (!process.env.GEMINI_API_KEY || !items.length) return [];
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const langName = MEANING_PROMPT[lang];
  const out = [];

  for (const it of items) {
    const prompt =
      `A reader lives in South Korea on a foreign passport — a worker, student or spouse.\n` +
      `They just read this news item:\n\n` +
      `${it.title}\n${it.summary.map(s => '- ' + s).join('\n')}\n\n` +
      `Write ONE sentence in ${langName} telling them what changes for them in practice: ` +
      `what they can now do, must do, or should check.\n` +
      `Rules:\n` +
      `- One sentence. No preamble, no label, no quotation marks.\n` +
      `- Concrete. Name the action, the date or the amount if the text has one.\n` +
      `- If the item genuinely changes nothing for such a reader, reply with exactly: SKIP\n`;

    try {
      await new Promise(r => setTimeout(r, GEMINI.CALL_INTERVAL_MS));
      const res = await ai.models.generateContent({ model: GEMINI.MODEL, contents: prompt });
      const t = String((res && res.text) || '').trim().replace(/^["'\s]+|["'\s]+$/g, '');
      if (!t || /^SKIP$/i.test(t)) continue;      // 해당 없는 항목은 뺀다
      it.meaning = t;
      out.push(it);
    } catch (e) {
      console.error('  [해설 실패] ' + it.title.slice(0, 50) + ' — ' + (e && e.message ? e.message : e));
    }
  }
  return out;
}

// 뉴스 페이지에서 요약을 꺼낸다
function readSummary(id) {
  const p = path.join(NEWS_DIR, id + '.html');
  if (!fs.existsSync(p)) return null;
  const h = fs.readFileSync(p, 'utf8');
  const m = h.match(/<section class="summary">([\s\S]*?)<\/section>/);
  if (!m) return null;
  const items = [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)]
    .map(x => x[1].replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);
  if (items.length) return items;
  const p1 = m[1].match(/<p>([\s\S]*?)<\/p>/);
  return p1 ? [p1[1].replace(/<[^>]+>/g, '').trim()] : null;
}

function pick(lang) {
  const p = path.join(DATA_DIR, `news_list_${lang}.json`);
  if (!fs.existsSync(p)) return [];
  const list = JSON.parse(fs.readFileSync(p, 'utf8'));
  const out = [];
  const seenTitle = new Set();

  for (const it of list) {
    if (!it.date || it.date.slice(0, 7) !== MONTH) continue;
    const best = classify(it.title || '');
    if (!best) continue;
    const key = (it.title || '').slice(0, 40);
    if (seenTitle.has(key)) continue;
    seenTitle.add(key);

    // 진짜 요약(항목 2개 이상)일 때만 싣는다.
    // RSS 원문 한 줄을 그대로 실으면 검색에 여는 페이지에 남의 기사 조각이 남는다.
    const summary = readSummary(it.id);
    if (!summary || summary.length < 2) continue;
    out.push({ ...it, topic: best.key, weight: best.weight, summary });
  }
  out.sort((a, b) => (b.weight - a.weight) || ((b.ts || 0) - (a.ts || 0)));
  return out;
}

function buildPage(lang, items) {
  const L = LABEL[lang];
  const [y, mo] = MONTH.split('-');
  const monthName = new Date(+y, +mo - 1, 1)
    .toLocaleDateString(lang === 'en' ? 'en-GB' : (lang === 'th' ? 'th-TH' : 'vi-VN'),
                        { year: 'numeric', month: 'long' });
  const canon = (l) => `https://www.koricare.kr/link/${l}/news/monthly/${MONTH}/`;
  const homeUrl = lang === 'en' ? '/link/index.html' : `/link/${lang}/index.html`;

  // 주제별로 묶는다
  const byTopic = {};
  for (const it of items) (byTopic[it.topic] = byTopic[it.topic] || []).push(it);

  const guideSeen = new Set();
  const sections = TOPICS.map(t => {
    const list = byTopic[t.key];
    if (!list || !list.length) return '';
    const cards = list.map(it => `
      <article class="item">
        <h3>${esc(it.title)}</h3>
        <ul>${it.summary.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        <p class="means"><span>${esc(L.means)}</span>${esc(it.meaning)}</p>
        <a class="src" href="${esc(it.link)}" target="_blank" rel="nofollow noopener">${esc(L.source)}</a>
      </article>`).join('');

    const guides = (GUIDE_FOR[t.key] || []).filter(g => {
      if (guideSeen.has(g.id)) return false;
      guideSeen.add(g.id); return true;
    });
    const guideHtml = guides.length ? `
      <p class="guides">${esc(L.guides)} ·
        ${guides.map(g => `<a href="/link/${lang}/guides/${g.cat}/${g.id}/">${g.id.replace(/_/g, ' ')}</a>`).join(' · ')}
      </p>` : '';

    return `<section class="topic">
      <h2 id="${t.key}">${esc(L.topic[t.key])}</h2>
      ${cards}
      ${guideHtml}
    </section>`;
  }).join('');

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': canon(lang) + '#article',
        headline: `${L.title} — ${monthName}`,
        description: L.intro.slice(0, 160),
        datePublished: `${MONTH}-01T00:00:00+09:00`,
        dateModified: new Date().toISOString().slice(0, 10) + 'T00:00:00+09:00',
        inLanguage: lang,
        isAccessibleForFree: true,
        mainEntityOfPage: { '@type': 'WebPage', '@id': canon(lang) },
        author: { '@type': 'Organization', name: 'Kori Care', url: 'https://www.koricare.kr' },
        publisher: {
          '@type': 'Organization', name: 'Kori Care', url: 'https://www.koricare.kr',
          logo: { '@type': 'ImageObject', url: 'https://www.koricare.kr/link/koricare_main_logo_nobg.png' }
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Kori Care', item: 'https://www.koricare.kr' + homeUrl },
          { '@type': 'ListItem', position: 2, name: L.title, item: canon(lang) }
        ]
      }
    ]
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
<meta name="description" content="${esc(L.intro.slice(0, 155))}">
<meta name="robots" content="index, follow, max-snippet:-1">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(L.title)} — ${esc(monthName)}">
<meta property="og:description" content="${esc(L.intro.slice(0, 155))}">
<meta property="og:url" content="${canon(lang)}">
<script type="application/ld+json">
${schema}
</script>
<style>
  :root { --bg:#fff; --tint:#f5f5f7; --ink:#1d1d1f; --sub:#6e6e73; --line:rgba(0,0,0,.10); --navy:#002366; --navy-l:#1e40af; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,"Noto Sans","Noto Sans Thai","Leelawadee UI",Arial,sans-serif;
    font-size:17px;line-height:1.62;letter-spacing:-.003em;-webkit-font-smoothing:antialiased;padding-bottom:56px}
  .wrap{max-width:700px;margin:0 auto;padding:0 20px}
  a{color:inherit;text-decoration:none}
  header{position:sticky;top:0;z-index:10;background:rgba(0,35,102,.92);
    -webkit-backdrop-filter:saturate(180%) blur(16px);backdrop-filter:saturate(180%) blur(16px);color:#fff}
  .hrow{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 20px;max-width:700px;margin:0 auto}
  .hrow b{font-size:17px;font-weight:700;letter-spacing:-.02em}
  h1{font-size:30px;line-height:1.18;font-weight:700;letter-spacing:-.024em;margin:26px 0 8px;text-wrap:balance}
  .month{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--sub);margin-top:22px}
  .intro{font-size:19px;line-height:1.55;color:var(--sub);letter-spacing:-.011em;margin-bottom:26px}
  .topic{margin-top:38px}
  .topic h2{font-size:24px;font-weight:700;letter-spacing:-.019em;margin-bottom:14px;scroll-margin-top:70px}
  .item{padding:18px 20px;background:var(--tint);border-radius:14px;margin-bottom:12px}
  .item h3{font-size:17.5px;font-weight:650;line-height:1.35;margin-bottom:9px}
  .item ul{margin:0;padding-left:20px}
  .item li{font-size:15.5px;line-height:1.62;color:#1e293b;margin-bottom:7px}
  .item li:last-child{margin-bottom:0}
  .item li::marker{color:#94a3b8}
  .means{margin-top:11px;padding-top:11px;border-top:1px solid rgba(0,0,0,.08);font-size:15px;line-height:1.6;color:var(--ink)}
  .means span{font-weight:650;color:var(--navy)}
  .src{display:inline-block;margin-top:10px;font-size:12.5px;color:var(--sub);text-decoration:underline;text-underline-offset:3px}
  .guides{margin-top:12px;font-size:14px;color:var(--sub)}
  .guides a{color:var(--navy-l);font-weight:500;box-shadow:inset 0 -1px 0 rgba(30,64,175,.3);text-transform:capitalize}
  .empty{padding:24px;background:var(--tint);border-radius:14px;color:var(--sub)}
  footer{margin-top:44px;padding-top:22px;border-top:1px solid var(--line);color:var(--sub);font-size:12.5px}
  .back{display:inline-flex;align-items:center;gap:8px;margin-top:34px;padding:13px 24px;border-radius:999px;background:var(--navy);color:#fff;font-size:15px;font-weight:600}
  @media(max-width:600px){body{font-size:16.5px}h1{font-size:25px}.intro{font-size:17.5px}.topic h2{font-size:21px}}
</style>
</head>
<body>
<header><div class="hrow"><a href="${homeUrl}"><b>Kori Care</b></a></div></header>
<main class="wrap">
  <p class="month">${esc(monthName)}</p>
  <h1>${esc(L.title)}</h1>
  <p class="intro">${esc(L.intro)}</p>
  ${items.length ? sections : `<p class="empty">${esc(L.empty)}</p>`}
  <a href="${homeUrl}" class="back">${esc(L.back)}</a>
  <footer>© 2026 Kori Care</footer>
</main>
</body>
</html>`;
}

// ── 실행 ──
(async () => {
  let total = 0;
  const made = [];

  for (const lang of ['en', 'th', 'vi']) {
    const picked = pick(lang);
    // 해설 한 줄을 붙인다. 못 붙은 항목은 여기서 빠진다.
    const items = dry ? picked : await addMeaning(picked, lang);
    const url = `https://www.koricare.kr/link/${lang}/news/monthly/${MONTH}/`;
    const dir = path.join(BASE, lang, 'news', 'monthly', MONTH);

    if (items.length < MIN_ITEMS) {
      console.log(`  [${lang}] ${items.length}건 — ${MIN_ITEMS}건 미만이라 페이지를 만들지 않는다`);
      // 지난번에 만들어 둔 것이 있으면 걷어낸다. 빈 페이지를 남겨 두지 않는다.
      if (!dry && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      continue;
    }

    total += items.length;
    console.log(`  [${lang}] ${items.length}건  주제: ${[...new Set(items.map(i => i.topic))].join(', ')}`);
    if (!dry) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), buildPage(lang, items), 'utf8');
    }
    made.push(url);
  }

  // 사이트맵 — 실제로 만든 페이지만 넣고, 안 만든 것은 뺀다
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
          xml = xml.replace(new RegExp(
            '  <url>\\n    <loc>' + url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
            '<\\/loc>[\\s\\S]*?<\\/url>\\n'), '');
        }
      }
      fs.writeFileSync(sp, xml, 'utf8');
    }
  }

  console.log((dry ? '[미리보기] ' : '') + MONTH + ' 월간 정리 · 실린 기사 ' + total + '건 · 페이지 ' + made.length + '장');
  console.log('  개별 뉴스는 noindex 그대로. 검색에 여는 것은 이 페이지뿐이다.');
  if (dry) console.log('  (미리보기에서는 해설 한 줄을 붙이지 않는다. 실제 실행 때 붙는다)');
})();
