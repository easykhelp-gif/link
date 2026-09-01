// unknown 폴더에 남은 항목을 제 행정구로 되돌린다.
//
// 이 항목들은 버릴 데이터가 아니다. 상호·전화·좌표가 모두 멀쩡하고,
// 주소에서 행정구 이름의 뒷글자만 깨져 있다.
//     "부산 사상▨▨▨ 운산로 80"   ← 사상구
// 앞 글자가 남아 있으므로 그 시도의 행정구 목록과 맞춰 보면 복구된다.
// 외부 호출이 필요 없다.
//
// 두 개 이상의 행정구에 걸리는 항목은 건드리지 않고 남긴다.
//
//   node recover_unknown.js --dry
//   node recover_unknown.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'data', 'split');
const dry = process.argv.includes('--dry');

// 시도별로 실제 존재하는 행정구 폴더와 그 한글 이름을 모은다
function districtsOf(region) {
  const dir = path.join(ROOT, region);
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'unknown') continue;
    // 폴더 안 아무 파일에서나 한글 행정구 이름을 읽는다
    for (const f of fs.readdirSync(path.join(dir, e.name))) {
      if (!f.endsWith('.json')) continue;
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, e.name, f), 'utf8'));
        if (j.district) { out.push({ slug: e.name, ko: j.district }); break; }
      } catch (err) { /* 다음 파일로 */ }
    }
  }
  return out;
}

// 주소에서 행정구 자리의 토큰을 뽑는다. 깨진 글자는 그대로 둔다.
// "부산 사상▨▨▨ 운산로 80" → "사상▨▨▨"
function districtToken(address) {
  const parts = String(address || '').split(/\s+/);
  return parts.length < 2 ? '' : parts[1].trim();
}

// 깨진 자리를 아무 글자로나 보고 행정구 이름과 맞춘다.
// 한 글자가 깨지면 대체문자가 1~3개로 늘어나므로 그만큼 폭을 준다.
//   "해▨▨대구"  → /^해.{0,3}대구$/  → 해운대구
//   "▨▨▨월군"   → /^.{0,3}월군$/    → 영월군
//   "사상▨▨▨"   → /^사상.{0,3}$/    → 사상구
function matchDistricts(token, districts) {
  const bad = /[�?]+/g;
  if (!token) return [];
  if (!bad.test(token)) {
    bad.lastIndex = 0;
    return districts.filter(d => d.ko === token);
  }
  bad.lastIndex = 0;
  const pattern = token
    .split(/[�?]+/)
    .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.{0,3}');
  const re = new RegExp('^' + pattern + '$');
  return districts.filter(d => re.test(d.ko));
}

const report = { moved: 0, ambiguous: [], nomatch: [] };
const pending = {};   // 목적지 파일 경로 → 옮길 레코드 배열

for (const region of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!region.isDirectory()) continue;
  const unknownDir = path.join(ROOT, region.name, 'unknown');
  if (!fs.existsSync(unknownDir)) continue;

  const districts = districtsOf(region.name);

  for (const f of fs.readdirSync(unknownDir)) {
    if (!f.endsWith('.json')) continue;
    const srcPath = path.join(unknownDir, f);
    let src;
    try { src = JSON.parse(fs.readFileSync(srcPath, 'utf8')); }
    catch (err) { console.log('파싱 실패 ' + srcPath); continue; }

    const keep = [];
    for (const pl of (src.places || [])) {
      const tok = districtToken(pl.address);
      if (!tok) { keep.push(pl); report.nomatch.push(pl.address); continue; }

      const hits = matchDistricts(tok, districts);

      if (hits.length === 0) { keep.push(pl); report.nomatch.push(pl.address); continue; }

      // 후보가 둘 이상이면 손대지 않는다. 잘못 옮기면 되돌리기 어렵다.
      if (hits.length > 1) {
        keep.push(pl);
        report.ambiguous.push({ address: pl.address, 후보: hits.map(h => h.ko) });
        continue;
      }
      const best = hits[0];

      // 주소의 깨진 글자를 올바른 행정구 이름으로 되돌린다
      const parts = String(pl.address).split(/\s+/);
      parts[1] = best.ko;
      pl.address = parts.join(' ');
      pl.district = best.ko;

      const dest = path.join(ROOT, region.name, best.slug, f);
      (pending[dest] = pending[dest] || []).push(pl);
      report.moved++;
    }

    if (!dry) {
      src.places = keep;
      src.places_count = keep.length;
      if (keep.length === 0) fs.unlinkSync(srcPath);
      else fs.writeFileSync(srcPath, JSON.stringify(src), 'utf8');
    }
  }
}

// 목적지 파일에 붙인다. id 가 겹치면 넣지 않는다.
let added = 0, dupes = 0, created = 0;
for (const [dest, list] of Object.entries(pending)) {
  let json;
  if (fs.existsSync(dest)) {
    json = JSON.parse(fs.readFileSync(dest, 'utf8'));
  } else {
    const seg = dest.split(path.sep);
    json = {
      region_id: seg[seg.length - 3],
      district: list[0].district,
      category: path.basename(dest, '.json'),
      places_count: 0,
      places: []
    };
    created++;
  }
  const seen = new Set((json.places || []).map(p => p.id));
  for (const pl of list) {
    if (seen.has(pl.id)) { dupes++; continue; }
    json.places.push(pl);
    seen.add(pl.id);
    added++;
  }
  json.places_count = json.places.length;
  if (!dry) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(json), 'utf8');
  }
}

// 빈 unknown 폴더를 치운다
if (!dry) {
  for (const region of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!region.isDirectory()) continue;
    const u = path.join(ROOT, region.name, 'unknown');
    if (fs.existsSync(u) && fs.readdirSync(u).length === 0) fs.rmdirSync(u);
  }
}

console.log((dry ? '[미리보기] ' : '') + '복구 ' + report.moved + '건');
console.log('  실제 편입   ' + added + '건 (새 파일 ' + created + '개)');
console.log('  중복 제외   ' + dupes + '건');
console.log('  판단 보류   ' + report.ambiguous.length + '건');
console.log('  못 찾음     ' + report.nomatch.length + '건');
report.ambiguous.slice(0, 6).forEach(a => console.log('    보류: ' + a.address + '  후보 ' + a.후보.join('/')));
report.nomatch.slice(0, 6).forEach(a => console.log('    미상: ' + a));
