// 공유 미리보기 이미지(og:image)를 언어별로 만든다.
//
// 왜 필요한가
//   카톡·페북·라인은 링크를 붙이면 og:image 를 미리보기로 띄운다.
//   그 자리에 500x630 로고만 나가고 있었다. 이름 말고는 아무것도 전달되지 않았다.
//
// 문구는 /link/ko/ 에 있는 우리 말을 그대로 쓴다.
//   BRAVE STEPS, SAFE LIFE            브랜드 태그라인
//   퇴직금 · 법률 · 생활 · 안전 · 이사   우리가 다루는 범위 (법률만 하는 게 아니다)
//
// 카톡은 미리보기를 300px 안팎으로 줄인다. 그 크기에서 살아남아야 하는 순서는
//   ① 이름  ② 범위 한 줄  ③ 태그라인
// 이 순서대로 크기를 준다. 범위 줄은 언어마다 길이가 달라서 폭에 맞춰 자동으로 줄인다.
//
//   npm install --no-save sharp        (돌릴 때만. optimize_hero_images.js 와 같은 이유로 package.json 에 없다)
//   node make_og_images.js

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('sharp 가 없다. 이 스크립트를 돌릴 때만 깔면 된다.');
  console.error('');
  console.error('  npm install --no-save sharp');
  process.exit(1);
}

const LOGO = path.join(__dirname, 'koricare_main_logo_nobg.png');
const OUT_DIR = path.join(__dirname, 'og');

const W = 1200, H = 630;
const NAVY = '#1e3a8a';
const SKY = '#93c5fd';
const PALE = '#dbeafe';
const TAGLINE = 'BRAVE STEPS, SAFE LIFE';
const MAX_TEXT_W = 1040;          // 좌우 여백 80px씩

// 언어별 "우리가 다루는 범위". /link/ko/ 의 다섯 항목과 같은 것들이다.
//   이사 → Housing. ko 페이지 본문이 "집을 구하고 옮기는 일" 이라 이쪽이 정확하다.
const SETS = {
  ko: '퇴직금 · 법률 · 생활 · 안전 · 이사',
  en: 'Severance · Law · Daily life · Safety · Housing',
  th: 'เงินชดเชย · กฎหมาย · ชีวิตประจำวัน · ความปลอดภัย · ที่พัก',
  vi: 'Trợ cấp · Pháp luật · Đời sống · An toàn · Nhà ở',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 글자 폭 어림값. 한글·태국어는 글자당 폭이 넓고 라틴은 좁다.
function estWidth(text, size) {
  let u = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) u += 1.0;         // 한글
    else if (c >= 0x0e00 && c <= 0x0e7f) u += 0.62;   // 태국어
    else if (ch === ' ') u += 0.28;
    else if (ch === '·') u += 0.40;
    else u += 0.52;                                    // 라틴 (베트남어 성조 포함)
  }
  return u * size;
}

function fitSize(text, start, min) {
  let s = start;
  while (s > min && estWidth(text, s) > MAX_TEXT_W) s -= 1;
  return s;
}

async function build(scope) {
  const size = fitSize(scope, 40, 24);
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${NAVY}"/>
  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${SKY}"/>
  <text x="${W / 2}" y="392" text-anchor="middle" font-family="Segoe UI, Malgun Gothic" font-size="94" font-weight="700" fill="#ffffff">Kori Care</text>
  <text x="${W / 2}" y="462" text-anchor="middle" font-family="Malgun Gothic, Leelawadee UI, Segoe UI" font-size="${size}" font-weight="600" fill="${PALE}">${esc(scope)}</text>
  <text x="${W / 2}" y="536" text-anchor="middle" font-family="Segoe UI" font-size="25" font-weight="600" letter-spacing="5" fill="${SKY}">${TAGLINE}</text>
</svg>`;
  const logo = await sharp(fs.readFileSync(LOGO))
    .resize({ width: 190, height: 190, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  return { buf: await sharp(Buffer.from(svg)).composite([{ input: logo, top: 72, left: Math.round(W / 2 - 95) }]).png().toBuffer(), size };
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('언어   범위 글자크기   파일크기   문구');
  for (const [lang, scope] of Object.entries(SETS)) {
    const { buf, size } = await build(scope);
    const f = path.join(OUT_DIR, 'koricare_og_' + lang + '.png');
    fs.writeFileSync(f, buf);
    console.log('  ' + lang + '   ' + String(size).padStart(8) + 'px' +
      String(Math.round(buf.length / 1024)).padStart(9) + 'KB   ' + scope);
  }
  console.log('');
  console.log('og/ 에 넣었다. 1200x630 · PNG.');
  console.log('PNG 로 두는 이유: 평평한 남색 위의 글자라 JPG 는 압축 자국이 남고,');
  console.log('webp 는 카톡·페북 스크레이퍼가 못 읽는 경우가 있다.');
})();
