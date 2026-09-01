// 같은 파일 안에 두 번 이상 들어간 장소를 정리한다.
//
// 왜 생겼나
//   전국 수집은 지도를 사각형 격자로 잘라 훑는다. 격자가 겹치는 자리의 장소가
//   여러 번 걸리는데, 저장할 때 id 로 걸러내지 않아 그대로 쌓였다.
//   2026-09-02 실측: 251,276건 중 19,767건(7.9%)이 같은 파일 안의 중복이다.
//
// 무엇을 지우나
//   같은 파일 · 같은 id 인 것만. 다른 업태 파일에 같은 id 가 있는 경우는 놔둔다
//   (미용 검색과 병원 검색에 둘 다 걸리는 곳이 실제로 있다. 2건뿐이다)
//
// 어느 쪽을 남기나
//   값이 더 채워진 쪽. 같으면 먼저 나온 것.
//   깨진 글자가 있는 쪽은 뒤로 민다.
//
//   node dedupe_places.js --dry
//   node dedupe_places.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'data', 'split');
const dry = process.argv.includes('--dry');
const BROKEN = /�/;
const FIELDS = ['name_ko', 'name_en', 'name_th', 'name_vi', 'category_detail',
                'address', 'phone', 'map_url', 'x', 'y', 'district'];

// 레코드가 얼마나 쓸 만한가. 높을수록 남긴다.
function score(pl) {
  let s = 0;
  for (const f of FIELDS) {
    const v = pl[f];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'string' && BROKEN.test(v)) { s -= 2; continue; }
    s += 1;
  }
  return s;
}

function walk(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, cb); continue; }
    if (!e.name.endsWith('.json') || e.name.startsWith('_') || e.name === 'map_index.json') continue;
    let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (x) { continue; }
    cb(p, j);
  }
}

let files = 0, before = 0, after = 0, touchedFiles = 0, keptBetter = 0;
const samples = [];
const dirty = new Map();

walk(ROOT, (p, j) => {
  const list = j.places || [];
  files++; before += list.length;
  if (!list.length) return;

  const best = new Map();
  const order = [];
  for (const pl of list) {
    const k = String(pl.id || '');
    if (!k) { order.push(pl); continue; }          // id 없는 것은 그대로 둔다
    if (!best.has(k)) { best.set(k, pl); order.push(k); continue; }
    const cur = best.get(k);
    if (score(pl) > score(cur)) {
      best.set(k, pl);
      keptBetter++;
      if (samples.length < 4) samples.push(p.replace(ROOT + path.sep, '') + '  ' + (pl.name_ko || ''));
    }
  }
  const out = order.map(x => (typeof x === 'string' ? best.get(x) : x));
  after += out.length;
  if (out.length !== list.length) {
    touchedFiles++;
    j.places = out;
    j.places_count = out.length;
    dirty.set(p, j);
  }
});

console.log('파일 ' + files.toLocaleString());
console.log('  전  ' + before.toLocaleString() + '건');
console.log('  후  ' + after.toLocaleString() + '건   (-' + (before - after).toLocaleString() + ')');
console.log('  손볼 파일 ' + touchedFiles.toLocaleString());
console.log('  중복 중 값이 더 나은 쪽으로 바꾼 것 ' + keptBetter.toLocaleString());
if (samples.length) {
  console.log('');
  samples.forEach(s => console.log('    ' + s));
}

if (dry) { console.log('\n[미리보기] 저장하지 않았다.'); process.exit(0); }

for (const [p, j] of dirty) fs.writeFileSync(p, JSON.stringify(j), 'utf8');
console.log('\n파일 ' + dirty.size.toLocaleString() + '개 저장');
console.log('다음  node build_size_index.js && node build_map_index.js');
