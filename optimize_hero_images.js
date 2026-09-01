// 가이드 히어로 이미지를 같은 규격으로 맞춘다.
//
// 히어로는 화면에서 가장 먼저 그려지는 그림이라 페이지 속도를 그대로 결정한다.
// 2026-09-01 실측: 새로 들어온 히어로 하나가 653KB 였다. 다른 것들은 26~86KB 다.
// 그 한 장 때문에 페이지 전송량이 90KB → 690KB 가 됐다.
//
//   규격   가로 1200px · webp 품질 82 · 원본 비율 유지
//   대상   news/images/ 안의 히어로 중 기준(120KB 또는 1200px 초과)을 넘는 것
//
//   npm install --no-save sharp        (돌릴 때만. 아래 설명을 볼 것)
//   node optimize_hero_images.js --dry
//   node optimize_hero_images.js
//
// 원본은 news/images/_original/ 에 남긴다. 되돌릴 수 있어야 한다.
//
// sharp 를 package.json 에 넣지 않는 이유
//   sharp 는 네이티브 모듈이라 의존성까지 20MB 다. 이 스크립트는 히어로 이미지를
//   새로 넣을 때만 사람이 손으로 돌린다. package.json 에 넣으면 매일 도는
//   뉴스 워크플로 3개가 npm install 할 때마다 20MB 를 더 받는다. 값이 안 맞는다.

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('sharp 가 없다. 이 스크립트를 돌릴 때만 깔면 된다.');
  console.error('');
  console.error('  npm install --no-save sharp');
  console.error('');
  console.error('package.json 에는 일부러 넣지 않았다. 파일 맨 위 설명을 볼 것.');
  process.exit(1);
}

const DIR = path.join(__dirname, 'news', 'images');
const KEEP = path.join(DIR, '_original');
const dry = process.argv.includes('--dry');

const MAX_WIDTH = 1200;
const QUALITY = 82;
const LIMIT_KB = 120;   // 이보다 크면 손본다

(async () => {
  const files = fs.readdirSync(DIR).filter(f => /hero.*\.webp$/i.test(f));

  console.log('히어로 이미지 ' + files.length + '장');
  console.log('');
  console.log('파일                                  크기    가로   조치');

  let changed = 0, saved = 0;
  for (const f of files) {
    const p = path.join(DIR, f);
    // 윈도우에서는 sharp 가 경로를 잡고 있으면 같은 파일에 못 쓴다. 버퍼로 읽는다
    const src = fs.readFileSync(p);
    const before = src.length;
    const meta = await sharp(src).metadata();
    const line = '  ' + f.padEnd(36) +
                 String(Math.round(before / 1024)).padStart(5) + 'KB  ' +
                 String(meta.width).padStart(5) + '   ';

    if (meta.width <= MAX_WIDTH && before / 1024 <= LIMIT_KB) {
      console.log(line + '그대로');
      continue;
    }

    const buf = await sharp(src)
      .resize({ width: Math.min(meta.width, MAX_WIDTH), withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();

    // 크게 줄지 않으면 손대지 않는다. 다시 인코딩하면 화질만 깎인다
    if (buf.length >= before * 0.9) {
      console.log(line + '그대로 (줄지 않음)');
      continue;
    }

    console.log(line + '→ ' + Math.round(buf.length / 1024) + 'KB');

    if (!dry) {
      fs.mkdirSync(KEEP, { recursive: true });
      const backup = path.join(KEEP, f);
      if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);
      fs.writeFileSync(p, buf);
    }
    changed++;
    saved += before - buf.length;
  }

  console.log('');
  console.log((dry ? '[미리보기] ' : '') + changed + '장 처리 · ' +
              Math.round(saved / 1024) + 'KB 절약');
  if (!dry && changed) console.log('원본은 news/images/_original/ 에 남겼다.');
})();
