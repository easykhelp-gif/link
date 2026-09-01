// 생성된 가이드 HTML 을 실제로 뜯어본다. 텍스트가 있는지가 아니라
// 태그 구조와 JSON-LD 가 유효한지를 본다.
//
// 세 언어가 다 차지 않은 원고는 build_guides.js 가 만들지 않는다(보류).
// 여기서도 같은 기준으로 걸러 검사한다.
const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const all = JSON.parse(fs.readFileSync(path.join(BASE, 'data/guides_list.json'), 'utf8'));
const MIN_BODY = 300;
const LANGS = ['en', 'th', 'vi'];

const held = all.filter(g =>
  LANGS.some(l => String(g['content_' + l] || '').length < MIN_BODY ||
                  !String(g['title_' + l] || '').trim()));
const guides = all.filter(g => !held.includes(g));

let fail = 0;
const bad = m => { console.log('  실패  ' + m); fail++; };

if (held.length) {
  console.log('보류 중인 원고 ' + held.length + '편 (세 언어가 다 차면 발행된다)');
  held.forEach(g => {
    const thin = LANGS.filter(l => String(g['content_' + l] || '').length < MIN_BODY);
    console.log('  · ' + g.id + '  비었거나 짧은 언어: ' + thin.join(', '));
  });
  console.log('');
}

for (const g of guides) {
  for (const lang of LANGS) {
    const p = path.join(BASE, lang, 'guides', g.category, g.id, 'index.html');
    const tag = `${g.id}/${lang}`;
    if (!fs.existsSync(p)) { bad(tag + ' 파일 없음'); continue; }
    const h = fs.readFileSync(p, 'utf8');

    // 1) JSON-LD 가 실제로 파싱되는가
    const m = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!m) { bad(tag + ' JSON-LD 블록 없음'); continue; }
    let data;
    try { data = JSON.parse(m[1]); }
    catch (e) { bad(tag + ' JSON-LD 파싱 오류: ' + e.message); continue; }

    const types = (data['@graph'] || []).map(n => n['@type']);
    if (!types.includes('Article')) bad(tag + ' Article 없음');
    if (!types.includes('BreadcrumbList')) bad(tag + ' BreadcrumbList 없음');
    const faqCount = (g['faq_' + lang] || []).length;
    if (faqCount && !types.includes('FAQPage')) bad(tag + ' FAQPage 빠짐');
    if (!faqCount && types.includes('FAQPage')) bad(tag + ' FAQ 없는데 FAQPage 들어감');

    const art = (data['@graph'] || []).find(n => n['@type'] === 'Article');
    if (art) {
      if (!art.headline) bad(tag + ' headline 비었음');
      if (!/^\d{4}-\d{2}-\d{2}T/.test(art.datePublished || '')) bad(tag + ' datePublished 형식: ' + art.datePublished);
      if (!art.description) bad(tag + ' description 비었음');
      if (art.inLanguage !== lang) bad(tag + ' inLanguage 불일치: ' + art.inLanguage);
    }

    // 2) FAQ 답이 실제 본문에 있는가 (구글은 화면에 없는 답을 무시한다)
    const faqNode = (data['@graph'] || []).find(n => n['@type'] === 'FAQPage');
    if (faqNode) {
      if (faqNode.mainEntity.length !== faqCount) bad(tag + ' FAQ 개수 불일치');
      for (const q of faqNode.mainEntity) {
        if (!q.name || !q.acceptedAnswer || !q.acceptedAnswer.text) { bad(tag + ' FAQ 항목 비었음'); break; }
        const body = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        const probe = q.acceptedAnswer.text.slice(0, 40).replace(/\s+/g, ' ');
        if (body.indexOf(probe) < 0) { bad(tag + ' FAQ 답이 본문에 없음: ' + q.name); break; }
      }
    }

    // 3) 목차 링크가 가리키는 id 가 본문에 있는가
    const toc = g['toc_' + lang] || [];
    if (toc.length >= 3) {
      if (h.indexOf('<details class="toc"') < 0) bad(tag + ' 목차 블록 없음');
      for (const s of toc) {
        if (h.indexOf('id="' + s.id + '"') < 0) { bad(tag + ' 목차 앵커 깨짐: #' + s.id); break; }
      }
    }

    // 4) 기본 태그 구조
    const h1 = (h.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) bad(tag + ' h1 개수 ' + h1);
    if (h.indexOf('<html lang="' + lang + '">') < 0) bad(tag + ' html lang 속성');
    if (h.indexOf('rel="canonical"') < 0) bad(tag + ' canonical 없음');
    if ((h.match(/hreflang="/g) || []).length < 4) bad(tag + ' hreflang 부족');
    if (h.indexOf('{{') >= 0) bad(tag + ' 치환 안 된 자리 남음');
    if (h.indexOf('<!--') >= 0 && !/^\s*<!DOCTYPE/i.test(h)) { /* doctype 외 주석 검사는 아래 */ }

    // 5) 원고에 쓴 내부 메모가 새어 나오지 않았는가
    //    파서가 HTML 주석을 그대로 통과시키므로, 원고에 메모를 쓰면 페이지에 실린다.
    //    범위는 본문 div 안쪽만 본다. 그 바깥에는 템플릿이 넣은 GA 주석이 있다.
    const bs = h.indexOf('<div class="article-body">');
    const be = h.indexOf('</article>', bs);
    if (bs >= 0 && be > bs && h.slice(bs, be).indexOf('<!--') >= 0) {
      bad(tag + ' 본문에 HTML 주석이 남았다 (내부 메모 유출)');
    }

    // 6) 표가 스크롤 껍데기 안에 들어갔는가
    const tables = (h.match(/<table>/g) || []).length;
    const scrolls = (h.match(/class="table-scroll"/g) || []).length;
    if (tables !== scrolls) bad(tag + ' 표 ' + tables + '개 중 스크롤 껍데기 ' + scrolls + '개');

    // 7) 빈 문단·깨진 목록
    if (h.indexOf('<p></p>') >= 0) bad(tag + ' 빈 문단 있음');
    if (/<li>\s*<\/li>/.test(h)) bad(tag + ' 빈 목록 항목');
  }
}

// 사이트맵 — 발행된 것만 있어야 하고, 보류된 것은 없어야 한다
const sm = fs.readFileSync(path.join(BASE, 'sitemap.xml'), 'utf8');
for (const g of guides) {
  for (const lang of LANGS) {
    const u = `https://www.koricare.kr/link/${lang}/guides/${g.category}/${g.id}/`;
    if (sm.indexOf(u) < 0) bad('사이트맵 누락: ' + u);
  }
}
for (const g of held) {
  for (const lang of LANGS) {
    const u = `https://www.koricare.kr/link/${lang}/guides/${g.category}/${g.id}/`;
    if (sm.indexOf(u) >= 0) bad('보류 중인데 사이트맵에 있다: ' + u);
    const p = path.join(BASE, lang, 'guides', g.category, g.id, 'index.html');
    if (fs.existsSync(p)) bad('보류 중인데 페이지가 있다: ' + p);
  }
}
if ((sm.match(/<loc>/g) || []).length !== (sm.match(/<\/loc>/g) || []).length) bad('사이트맵 태그 불일치');

console.log(fail === 0
  ? '전부 통과 — 발행 ' + guides.length + '편 × 3언어 = ' + guides.length * 3 + '페이지'
  : '\n실패 ' + fail + '건');
process.exit(fail ? 1 : 0);
