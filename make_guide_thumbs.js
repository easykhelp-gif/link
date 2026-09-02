// 가이드 대표 이미지(썸네일)를 언어별로 만든다.
//
// 이 그림은 글 머리에만 쓰이는 게 아니라 og:image 로도 나간다. 카톡·페북에
// 링크를 붙이면 이게 통째로 미리보기가 되므로, 무슨 글인지 읽혀야 한다.
// 그래서 언어마다 한 장씩 만든다.
//
// 글자는 생성기에 맡기지 않는다. 태국어는 위아래로 붙는 결합 기호가 있어
// 이미지 생성기가 거의 반드시 망가뜨린다. 배경만 생성기로 받고 글자는 여기서
// 얹는다. 폰트·위치·색이 세 장에서 정확히 같아진다.
//
//   사용법  node make_guide_thumbs.js <배경파일> <출력이름>
//   예      node make_guide_thumbs.js ~/Downloads/helmet.jpeg guide_work_death_survivor
//
// 결과      news/images/<이름>_hero_en.webp  (th, vi 도 같이)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const W = 1200, H = 800;          // 기존 히어로 8장이 전부 이 규격이다
const OUT_DIR = path.join(__dirname, 'news', 'images');

// 왼쪽 2/3 이 글자 자리다. 배경 헬멧은 오른쪽에 있다.
const PAD_X = 72;
const MAX_W = 600;   // 이보다 길어지면 헬멧에 닿는다

const COPY = {
  en: {
    font: "'Segoe UI', 'Arial', sans-serif",
    l1: 'Died at work in Korea?',
    l2: '1,300 days of wages',
    l3: 'The family can still claim it',
    s1: 42, s2: 66, s3: 34,
  },
  th: {
    // 리라와디 UI. 윈도우 기본 태국어 서체이고 굵기가 있어 제목에 쓸 만하다.
    font: "'Leelawadee UI', 'Tahoma', sans-serif",
    l1: 'เสียชีวิตจากการทำงานในเกาหลี',
    l2: 'ค่าจ้าง 1,300 วัน',
    l3: 'ครอบครัวยังมีสิทธิได้รับ',
    s1: 40, s2: 66, s3: 34,
  },
  vi: {
    font: "'Segoe UI', 'Arial', sans-serif",
    // 베트남어는 천 단위를 마침표로 쓴다
    l1: 'Tử vong khi làm việc tại Hàn Quốc',
    l2: '1.300 ngày lương',
    l3: 'Gia đình vẫn được nhận',
    s1: 38, s2: 66, s3: 34,
  },
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 글자 폭을 어림한다. 정확할 필요는 없고 '헬멧에 닿는가' 만 알면 된다.
// 라틴 굵은 글씨는 글자당 약 0.52배, 태국어는 결합 기호가 폭을 안 먹어서
// 0.46배쯤 된다. 넘치면 그 줄만 줄인다 — 세 언어의 줄 길이가 제각각이라
// 언어마다 손으로 맞추면 다음 가이드에서 또 어긋난다.
function fit(text, size, weight) {
  const thai = /[฀-๿]/.test(text);
  // 태국어의 위아래 결합 기호는 폭을 차지하지 않는다
  const n = thai ? text.replace(/[ัิ-ฺ็-๎]/g, '').length : text.length;
  const k = thai ? 0.46 : (weight >= 700 ? 0.55 : 0.50);
  const w = n * size * k;
  if (w <= MAX_W) return size;
  return Math.floor(size * (MAX_W / w));
}

function overlaySvg(c0) {
  const c = Object.assign({}, c0);
  c.s1 = fit(c.l1, c.s1, 600);
  c.s2 = fit(c.l2, c.s2, 700);
  c.s3 = fit(c.l3, c.s3, 400);

  // 세 줄을 세로 가운데에 놓는다. 줄 간격은 글자 크기에 비례시킨다.
  const g1 = c.s1 * 1.35, g2 = c.s2 * 1.20, g3 = c.s3 * 1.4;
  const total = g1 + g2 + g3;
  let y = (H - total) / 2 + c.s1;

  const y1 = y;
  const y2 = y1 + g1 + c.s2 * 0.10;
  const y3 = y2 + g2;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"    stop-color="#04101f" stop-opacity="0.78"/>
      <stop offset="0.55" stop-color="#04101f" stop-opacity="0.45"/>
      <stop offset="1"    stop-color="#04101f" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${Math.round(W * 0.72)}" height="${H}" fill="url(#shade)"/>
  <text x="${PAD_X}" y="${y1}" font-family="${c.font}" font-size="${c.s1}"
        font-weight="600" fill="#ffffff">${esc(c.l1)}</text>
  <text x="${PAD_X}" y="${y2}" font-family="${c.font}" font-size="${c.s2}"
        font-weight="700" fill="#ffc72c">${esc(c.l2)}</text>
  <text x="${PAD_X}" y="${y3}" font-family="${c.font}" font-size="${c.s3}"
        font-weight="400" fill="#e2eaf5">${esc(c.l3)}</text>
</svg>`);
}

(async () => {
  const src = process.argv[2];
  const name = process.argv[3];
  if (!src || !name) {
    console.error('  사용법: node make_guide_thumbs.js <배경파일> <출력이름>');
    process.exit(1);
  }
  if (!fs.existsSync(src)) { console.error('  ★ 배경 파일 없음: ' + src); process.exit(1); }

  // 윈도우에서 sharp 가 원본 파일을 붙들고 있으면 다음 쓰기가 막힌다.
  // 버퍼로 먼저 읽는다.
  const buf = fs.readFileSync(src);
  const meta = await sharp(buf).metadata();
  console.log('  배경  ' + meta.width + ' x ' + meta.height + '  ' + (buf.length / 1024).toFixed(0) + 'KB');

  // 3:2 로 맞춘다. 헬멧과 바닥선이 아래쪽에 있으므로 위를 잘라낸다.
  const targetH = Math.round(meta.width / (W / H));
  const cropTop = Math.max(0, meta.height - targetH);
  if (cropTop > 0) console.log('  자름  위에서 ' + cropTop + 'px  → ' + meta.width + ' x ' + targetH);

  const base = await sharp(buf)
    .extract({ left: 0, top: cropTop, width: meta.width, height: Math.min(targetH, meta.height) })
    .resize(W, H, { fit: 'cover' })
    .toBuffer();

  // 확인용 PNG 는 저장소 밖에 둔다. 한 장에 750KB 라 여기 두면 그대로 쌓인다.
  const checkDir = process.env.TEMP
    ? path.join(process.env.TEMP, 'koricare_thumb_check')
    : path.join(require('os').tmpdir(), 'koricare_thumb_check');
  fs.mkdirSync(checkDir, { recursive: true });

  for (const lang of ['en', 'th', 'vi']) {
    const out = path.join(OUT_DIR, name + '_hero_' + lang + '.webp');
    const png = path.join(checkDir, name + '_' + lang + '.png');
    const img = sharp(base).composite([{ input: overlaySvg(COPY[lang]), top: 0, left: 0 }]);
    await img.clone().webp({ quality: 84 }).toFile(out);
    await img.clone().png().toFile(png);
    const kb = (fs.statSync(out).size / 1024).toFixed(0);
    console.log('  ' + lang + '  ' + kb.padStart(3) + 'KB  ' + path.basename(out));
  }
  console.log('');
  console.log('  확인용 PNG: ' + checkDir);
})();
