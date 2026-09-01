// 재수집한 레코드를 라이브 데이터에 반영한다.
//
// merge_split_new.js 는 "새 장소를 추가"하는 도구라 이미 있는 id 는 건너뛴다.
// 이 도구는 반대다. 장소는 그대로 있고 값만 깨져 있었으므로,
// 기존 레코드의 그 값만 고쳐 쓴다.
//
// apply_address_fix.js 를 대신한다. 그것은 주소만 봤는데,
// 2026-09-02 실측에서 주소는 0건이고 상호 712건 · 업태 세부 1,032건이 깨져 있었다.
//
// 지키는 것
//   · 라이브에서 실제로 깨져 있던 값만 바꾼다. 멀쩡한 값은 손대지 않는다
//     (그동안 손본 이름이 카카오 것으로 덮이면 안 된다)
//   · 행정구(district)를 옮기지 않는다. 특히 unknown 으로 되돌리지 않는다
//   · 새 값이 여전히 깨져 있거나 비어 있으면 반영하지 않는다
//   · 좌표·전화·id 는 건드리지 않는다
//
//   node apply_broken_fix.js --dry
//   node apply_broken_fix.js

const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const NEW = path.join(BASE, 'data', 'split_new');
const LIVE = path.join(BASE, 'data', 'split');
const dry = process.argv.includes('--dry');

const BROKEN = /�/;
// 깨질 수 있고, 고쳐도 되는 값들. district 는 일부러 뺐다.
const FIELDS = ['name_ko', 'name_en', 'name_th', 'name_vi', 'category_detail', 'address'];

if (!fs.existsSync(NEW)) { console.log('data/split_new/ 가 없다'); process.exit(0); }

function walk(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, cb); continue; }
    if (!e.name.endsWith('.json') || e.name.startsWith('_') || e.name === 'map_index.json') continue;
    let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (x) { continue; }
    cb(p, j);
  }
}

// 재수집분을 id 로 모은다
const fixes = new Map();
let rejected = 0;
walk(NEW, (p, j) => {
  for (const pl of (j.places || [])) {
    if (!pl.id) continue;
    const clean = {};
    for (const f of FIELDS) {
      const v = pl[f];
      if (typeof v !== 'string' || !v.trim()) continue;
      if (BROKEN.test(v)) { rejected++; continue; }
      clean[f] = v;
    }
    if (Object.keys(clean).length) fixes.set(String(pl.id), clean);
  }
});
console.log('재수집분 ' + fixes.size + '건' + (rejected ? '  (깨진 값 ' + rejected + '개는 버렸다)' : ''));

let touched = 0, changedFields = 0, unchanged = 0, notInNew = 0;
const perField = {};
const samples = [];
const dirty = new Map();

walk(LIVE, (p, j) => {
  let hit = false;
  for (const pl of (j.places || [])) {
    // 라이브에서 실제로 깨진 값이 있는 레코드만 대상
    const broken = FIELDS.filter(f => BROKEN.test(String(pl[f] || '')));
    if (!broken.length) continue;

    const fix = fixes.get(String(pl.id));
    if (!fix) { notInNew++; continue; }

    let did = false;
    for (const f of broken) {
      const next = fix[f];
      if (!next || next === pl[f]) { unchanged++; continue; }
      if (samples.length < 6) samples.push({ f, b: String(pl[f]).slice(0, 34), a: next.slice(0, 34) });
      pl[f] = next;
      perField[f] = (perField[f] || 0) + 1;
      changedFields++; did = true;
    }
    if (did) { touched++; hit = true; }
  }
  if (hit) dirty.set(p, j);
});

console.log('');
console.log('고칠 레코드      ' + touched);
console.log('고칠 값          ' + changedFields);
console.log('재수집분에 없음   ' + notInNew + '  (반경 안에서 못 찾은 것들)');
console.log('');
console.log('필드별');
for (const f of FIELDS) if (perField[f]) console.log('  ' + f.padEnd(16) + perField[f]);
console.log('');
console.log('예시');
samples.forEach(s => {
  console.log('  [' + s.f + ']');
  console.log('    전: ' + s.b);
  console.log('    후: ' + s.a);
});

if (dry) {
  console.log('');
  console.log('[미리보기] 파일 ' + dirty.size + '개가 바뀔 예정. 저장하지 않았다.');
  process.exit(0);
}

for (const [p, j] of dirty) fs.writeFileSync(p, JSON.stringify(j), 'utf8');
console.log('');
console.log('파일 ' + dirty.size + '개 저장');

// 반영 후 다시 센다
let still = 0;
walk(LIVE, (p, j) => {
  for (const pl of (j.places || [])) {
    if (FIELDS.some(f => BROKEN.test(String(pl[f] || '')))) still++;
  }
});
console.log('아직 깨진 레코드  ' + still);
console.log('');
console.log('다음  node build_size_index.js && node build_map_index.js');
