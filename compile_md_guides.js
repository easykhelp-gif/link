const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data', 'guides_content');
const listPath = path.join(__dirname, 'data', 'guides_list.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Simple markdown to HTML parser tailored for our needs
function stripPipes(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
}

// 제목에서 앵커 id 를 만든다.
// 태국어 제목에는 ASCII 문자가 하나도 없다. 순번으로 대체하면 목차와 본문이
// 서로 다른 번호를 매겨 링크가 어긋나므로, 제목 문자열 자체의 해시를 쓴다.
// 같은 제목이면 어디서 부르든 같은 id 가 나온다.
function headingId(text) {
  const t = String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();
  let id = t.toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!/[a-z0-9]/.test(id)) {
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
    id = 's' + h.toString(36);
  }
  return encodeURIComponent(id).slice(0, 80);
}

// 마크다운을 평문으로 (스키마·목차에 넣을 때 태그가 섞이면 안 된다)
function plain(s) {
  return String(s)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 목차 — h2 를 뽑는다. h3 까지 넣으면 목록이 길어져 오히려 안 읽힌다.
// 다만 옛 글들은 h2 를 한 개만 쓰고 h3 로 본문을 나눴다. 그런 글은
// 목차가 한 줄뿐이라 쓸모가 없으므로 h3 으로 내려가서 뽑는다.
function extractToc(md) {
  if (!md) return [];
  const pick = (level) => {
    const re = new RegExp('^' + '#'.repeat(level) + ' (.+)$');
    const out = [];
    for (const line of md.split('\n')) {
      const m = line.match(re);
      if (m) out.push({ id: headingId(m[1]), text: plain(m[1]) });
    }
    return out;
  };
  const h2 = pick(2);
  if (h2.length >= 3) return h2;
  const h3 = pick(3);
  return h3.length >= 3 ? h3 : h2;
}

// FAQ — 물음표로 끝나는 h2·h3 소제목과 그 아래 문단을 짝짓는다.
// 물음표를 기준으로 삼아야 일반 소제목이 FAQ 로 잘못 올라가지 않는다.
// 구글은 답변이 실제로 페이지에 보여야 리치결과를 준다. 스키마 전용 문구를
// 따로 만들지 않고 본문에서 그대로 뽑는 이유다.
// 물음표로 끝나는 제목만 FAQ 로 본다.
// 언어별 의문 어미를 추측하면 태국어에서만 걸리는 제목이 생겨 세 언어의
// FAQ 개수가 어긋난다. 원고에서 세 언어 모두 물음표를 붙이는 것이 규칙이다.
function isQuestion(t) {
  return /[?？]\s*$/.test(t.trim());
}

function extractFaq(md) {
  if (!md) return [];
  const out = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,3}) (.+)$/);
    if (!m || !isQuestion(m[2])) continue;
    const q = plain(m[2]);
    const buf = [];
    // 다음 소제목까지 전부 모은다. 빈 줄에서 끊으면 첫 문장만 남아
    // 답이 되지 않는다.
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (/^#{2,4} /.test(l)) break;
      if (/^\s*\|/.test(l)) continue;          // 표는 답변에서 제외
      if (!l.trim()) continue;
      buf.push(plain(l.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')));
      if (buf.join(' ').length > 900) break;
    }
    let a = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (a.length > 900) {
      // 문장 경계에서 자른다. 말이 중간에 끊기면 리치결과에 그대로 나온다.
      const cut = a.slice(0, 900);
      const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('। '), cut.lastIndexOf('? '));
      a = (stop > 400 ? cut.slice(0, stop + 1) : cut).trim();
    }
    if (q && a.length >= 20) out.push({ q, a });
  }
  return out;
}

// 읽는 데 걸리는 시간.
// 태국어는 단어 사이에 공백이 없어서 단어수로 세면 한 문장이 한 단어가 된다.
// 한글·한자도 마찬가지다. 그 세 계열만 글자수로 세고, 나머지(베트남어 포함)는
// 단어수로 센다. 베트남어를 성조 부호 때문에 비라틴으로 세면 시간이 두 배가 된다.
function readingMinutes(md) {
  if (!md) return 1;
  const t = plain(md);
  const thai = (t.match(/[฀-๿]/g) || []).length;
  const cjk = (t.match(/[　-鿿가-힯]/g) || []).length;
  const words = (t.replace(/[฀-๿　-鿿가-힯]/g, ' ')
    .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  return Math.max(1, Math.round(words / 200 + thai / 950 + cjk / 500));
}

// 요약 문단 — 첫 소제목보다 앞에 놓인 문단이 이 글의 요약이다.
// 검색결과 설명문과 AI 요약이 그대로 가져가는 자리라, 글쓴이가 의도한 한 문단이
// 와야 한다.
//
// 그 문단은 본문에서 빼고 돌려준다. 빼지 않으면 화면 위쪽의 요약과 본문 첫
// 문단에 같은 글이 두 번 나온다.
// 요약이 따로 없는 옛 글은 본문 첫 문단을 요약으로 빌려 쓰되, 본문은 건드리지
// 않는다. 그 글에서는 그 문단이 본문의 일부이기 때문이다.
function splitLede(md) {
  if (!md) return { lede: '', summary: '', body: '' };
  const firstHeading = md.search(/(^|\n)#{2,4} /);
  const intro = firstHeading < 0 ? md : md.slice(0, firstHeading);

  const blocks = intro.split(/\n\s*\n/);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i].trim();
    if (!b || /^#/.test(b) || /^\|/.test(b) || /^[->]/.test(b)) continue;
    const p = plain(b);
    if (p.length < 40) continue;
    blocks.splice(i, 1);
    const rest = blocks.join('\n\n').trim();
    return {
      lede: p,
      summary: p,
      body: (rest ? rest + '\n\n' : '') + (firstHeading < 0 ? '' : md.slice(firstHeading).trim())
    };
  }

  // 머리말이 없는 글 — 본문 첫 문단을 검색결과 설명문으로만 빌려 쓴다.
  // 화면 위에 또 띄우면 바로 아래 본문과 같은 글이 두 번 나온다.
  for (const block of md.split(/\n\s*\n/)) {
    const b = block.trim();
    if (!b || /^#/.test(b) || /^\|/.test(b) || /^[->]/.test(b)) continue;
    const p = plain(b);
    if (p.length >= 40) return { lede: '', summary: p, body: md };
  }
  return { lede: '', summary: '', body: md };
}

function mdToHtml(md) {

  let html = md.trim();
  if (!html) return '';
  
  // Headers — 앵커 id 를 붙인다.
  // 목차 링크에 쓰이고, AI 가 특정 섹션을 인용할 때 주소를 가리킬 수 있다.
  // h4 까지 받는다. 긴 글은 3단으로 부족하다.
  html = html.replace(/^#### (.*$)/gim, (m, t) => `<h4 id="${headingId(t)}">${t}</h4>`);
  html = html.replace(/^### (.*$)/gim, (m, t) => `<h3 id="${headingId(t)}">${t}</h3>`);
  html = html.replace(/^## (.*$)/gim, (m, t) => `<h2 id="${headingId(t)}">${t}</h2>`);
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Images  ![alt](src) -> <img>   (링크 변환보다 먼저 처리)
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_m, alt, src) {
    return '<img src="' + src + '" alt="' + alt + '" loading="lazy">';
  });

  // Links  [text](url) -> <a href="url">text</a>
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, text, url) {
    var ext = /^https?:/.test(url);
    return '<a href="' + url + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + text + '</a>';
  });

  // 블록 요소 바로 앞에 빈 줄이 없으면 넣는다.
  // 원고에서 "다음과 같습니다:" 다음 줄에 바로 "- 항목" 을 쓰거나, 문단 바로
  // 다음 줄에 "## 소제목" 을 쓰는 일이 잦다. 문단 나누기가 빈 줄 기준이라
  // 그대로 두면 목록·소제목이 앞 문단 안으로 들어가고, <p> 안에 <ul> 이나
  // <h2> 가 박힌다. HTML 규칙 위반이라 브라우저가 빈 <p> 를 끼워 넣는다. (2026-09-01)
  {
    const isItem = (l) => /^[ \t]*(?:\- |\d+\. )/.test(l);
    // 소제목은 이 지점보다 앞에서 이미 <h2 id="..."> 로 바뀌어 있다.
    // 마크다운 형태와 태그 형태를 둘 다 본다.
    const isHead = (l) => /^[ \t]*(?:#{1,6} |<h[1-6][\s>])/.test(l);
    const lines = html.split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const cur = lines[i];
      const prev = lines[i - 1];
      const needsGap = (isItem(cur) && !isItem(prev || '')) || isHead(cur);
      if (needsGap && prev !== undefined && prev.trim()) out.push('');
      out.push(cur);
    }
    html = out.join('\n');
  }

  // Lists
  // 앞을 \s* 로 두면 안 된다. \s 에 줄바꿈이 들어가서 목록 앞의 빈 줄까지 먹고,
  // 그러면 목록이 앞 문단에 붙어 <p>…<br><ul>…</ul></p> 가 된다.
  // <p> 안의 <ul> 은 HTML 규칙 위반이라 브라우저가 빈 <p> 를 만들어 넣는다. (2026-09-01)
  html = html.replace(/^[ \t]*\- (.*$)/gim, '<ul><li>$1</li></ul>');
  html = html.replace(/<\/ul>\n<ul>/g, '\n');
  
  // Blockquote  "> text" -> <blockquote>
  html = html.replace(/^[ \t]*&gt; (.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/^[ \t]*> (.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br>');

  // Ordered list  "1. text" -> <ol><li>
  html = html.replace(/^[ \t]*\d+\. (.*$)/gim, '<ol><li>$1</li></ol>');
  html = html.replace(/<\/ol>\n<ol>/g, '');

  // Tables
  // Detect table blocks
  let tableRegex = /((?:\|.*\|\n)+)/g;
  html = html.replace(tableRegex, (match) => {
    let lines = match.trim().split('\n');
    if (lines.length < 3) return match; // Not a valid table
    
    let tableHtml = '<div class="table-wrap"><div class="table-scroll"><table><thead><tr>';
    let headers = stripPipes(lines[0]);
    headers.forEach(h => { tableHtml += `<th>${h.trim()}</th>`; });
    tableHtml += '</tr></thead><tbody>';
    
    for (let i = 2; i < lines.length; i++) {
      let cells = stripPipes(lines[i]);
      if (cells.length > 0) {
        tableHtml += '<tr>';
        cells.forEach(c => { tableHtml += `<td>${c.trim()}</td>`; });
        tableHtml += '</tr>';
      }
    }
    tableHtml += '</tbody></table></div></div>';
    // 앞뒤로 빈 줄을 붙인다. 표 치환이 뒤 문단의 줄바꿈까지 먹어버리면
    // 표와 뒤 문단이 한 덩어리가 되고, 그 덩어리는 <div 로 시작해서
    // HTML 블록으로 통과되므로 뒤 문단이 <p> 없이 맨 텍스트로 나온다. (2026-09-01)
    return '\n\n' + tableHtml + '\n\n';
  });
  
  // Paragraphs
  html = html.split('\n\n').map(p => {
    // 빈 덩어리는 버린다. 표·목록 앞뒤에 빈 줄을 넣다 보면 생기는데
    // 그대로 두면 <p></p> 가 나온다.
    if (!p.trim()) return '';
    // 원고에 직접 쓴 HTML 블록은 그대로 둔다. 한 번 더 <p> 로 감싸면
    // 문단 안에 문단이 들어간 잘못된 구조가 된다.
    if (/^<(h[1-6]|ul|ol|table|div|figure|blockquote|p|section|aside)[\s>]/.test(p.trim())) return p;
    return `<p>${p.trim().replace(/\n/g, '<br>')}</p>`;
  }).filter(Boolean).join('\n');
  
  // 목록 항목 사이에 끼어드는 <br> 제거 (2026-08-31)
  html = html.replace(/<\/li>\s*<br>\s*<li>/g, '</li><li>');
  html = html.replace(/<(ul|ol)>\s*<br>\s*/g, '<$1>');
  html = html.replace(/\s*<br>\s*<\/(ul|ol)>/g, '</$1>');
  // 문단 끝에 남는 <br> 제거
  html = html.replace(/(<br>)+<\/p>/g, '</p>');

  return html;
}

function processGuides() {
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.md'));
  let guides = [];
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(dataDir, file), 'utf8').replace(/\r\n/g, '\n');
    
    // Parse Meta
    const metaMatch = content.match(/---\n([\s\S]*?)\n---/);
    if (!metaMatch) return;
    
    const metaStr = metaMatch[1];
    let meta = {};
    metaStr.split('\n').forEach(line => {
      const parts = line.split(': ');
      if (parts.length >= 2) {
        meta[parts[0].trim()] = parts.slice(1).join(': ').trim();
      }
    });
    
    // Parse Languages
    const getLangSection = (lang) => {
      const regex = new RegExp(`<!-- ${lang} START -->([\\s\\S]*?)<!-- ${lang} END -->`);
      const match = content.match(regex);
      return match ? match[1].trim() : '';
    };
    
    const title_en = getLangSection('TITLE_EN');
    const title_th = getLangSection('TITLE_TH');
    const title_vi = getLangSection('TITLE_VI');
    
    const en_md = getLangSection('EN');
    const th_md = getLangSection('TH');
    const vi_md = getLangSection('VI');

    const en = splitLede(en_md);
    const th = splitLede(th_md);
    const vi = splitLede(vi_md);

    guides.push({
      id: meta.id,
      category: meta.category,
      tag: meta.tag,
      title_en: title_en,
      title_th: title_th,
      title_vi: title_vi,
      image: meta.image,
      date: meta.date,
      updated: meta.updated || meta.date,
      content_en: mdToHtml(en.body),
      content_th: mdToHtml(th.body),
      content_vi: mdToHtml(vi.body),
      // 목차 — 긴 글의 이탈을 막고, 구글이 사이트링크로 쓸 수 있다
      toc_en: extractToc(en_md),
      toc_th: extractToc(th_md),
      toc_vi: extractToc(vi_md),
      // FAQ 스키마용. "## FAQ" 섹션 안의 "### 질문" 과 그 아래 문단을 뽑는다
      faq_en: extractFaq(en_md),
      faq_th: extractFaq(th_md),
      faq_vi: extractFaq(vi_md),
      // 첫 문단 — AI 가 그대로 인용하는 자리
      lede_en: en.lede,
      lede_th: th.lede,
      lede_vi: vi.lede,
      summary_en: en.summary,
      summary_th: th.summary,
      summary_vi: vi.summary,
      mins_en: readingMinutes(en_md),
      mins_th: readingMinutes(th_md),
      mins_vi: readingMinutes(vi_md)
    });
  });
  
  fs.writeFileSync(listPath, JSON.stringify(guides, null, 2), 'utf8');
  console.log(`Successfully compiled ${guides.length} guides into guides_list.json`);
}

processGuides();
