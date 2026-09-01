// 재수집한 주소를 라이브 데이터에 반영한다.
//
// merge_split_new.js 는 "새 장소를 추가"하는 도구라 이미 있는 id 는 건너뛴다.
// 이번 건은 다르다. 장소는 그대로 있고 주소만 깨져 있었으므로,
// 기존 레코드의 주소를 고쳐 써야 한다.
//
// 지키는 것
//   · 주소만 바꾼다. 이름·전화·좌표·행정구는 건드리지 않는다
//   · 행정구를 옮기지 않는다. 특히 unknown 으로 되돌리지 않는다
//     (안티가 옛 목록을 써서 9건이 unknown 으로 되어 있다.
//      그 9건은 코코가 이미 좌표로 확정해 제 행정구에 넣어 둔 것이다)
//   · 새 주소가 여전히 깨져 있으면 반영하지 않는다
//
//   node apply_address_fix.js --dry
//   node apply_address_fix.js

const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const NEW = path.join(BASE, 'data', 'split_new');
const LIVE = path.join(BASE, 'data', 'split');
const dry = process.argv.includes('--dry');

if (!fs.existsSync(NEW)) { console.log('data/split_new/ 가 없다'); process.exit(0); }

function walk(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, cb); continue; }
    if (!e.name.endsWith('.json') || e.name.startsWith('_') || e.name === 'map_index.json') continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (x) { console.log('파싱 실패 ' + p); continue; }
    cb(p, j);
  }
}

// 재수집분에서 id → 새 주소
const fixes = new Map();
let rejected = 0;
walk(NEW, (p, j) => {
  for (const pl of (j.places || [])) {
    if (!pl.id || !pl.address) continue;
    // 새 주소가 여전히 깨져 있으면 쓰지 않는다
    if (/�/.test(pl.address)) { rejected++; continue; }
    fixes.set(pl.id, pl.address);
  }
});
console.log('재수집분에서 쓸 수 있는 주소 ' + fixes.size + '건' +
            (rejected ? ' (여전히 깨진 것 ' + rejected + '건 제외)' : ''));

let updated = 0, unchanged = 0, notFound = 0, stillBroken = 0;
const touched = new Set();
const samples = [];

walk(LIVE, (p, j) => {
  let dirty = false;
  for (const pl of (j.places || [])) {
    const next = fixes.get(pl.id);
    if (!next) continue;
    if (pl.address === next) { unchanged++; continue; }
    if (samples.length < 5) samples.push({ n: pl.name_ko, b: pl.address, a: next });
    pl.address = next;
    updated++;
    dirty = true;
  }
  if (dirty) {
    touched.add(p);
    if (!dry) fs.writeFileSync(p, JSON.stringify(j), 'utf8');
  }
});

// 반영 후 남은 깨짐
walk(LIVE, (p, j) => {
  for (const pl of (j.places || [])) if (/�/.test(pl.address || '')) stillBroken++;
});

notFound = fixes.size - updated - unchanged;

console.log((dry ? '[미리보기] ' : '') + '주소 고침 ' + updated + '건 · 파일 ' + touched.size + '개');
console.log('  이미 같았던 것    ' + unchanged + '건');
console.log('  라이브에 없는 id   ' + (notFound > 0 ? notFound : 0) + '건');
console.log('  반영 후 남은 깨짐  ' + stillBroken + '건' + (dry ? ' (미리보기라 그대로)' : ''));
console.log('\n표본');
samples.forEach(s => {
  console.log('  ' + s.n);
  console.log('    전: ' + s.b);
  console.log('    후: ' + s.a);
});
if (!dry && updated) console.log('\n다음: node build_size_index.js && node build_map_index.js');
