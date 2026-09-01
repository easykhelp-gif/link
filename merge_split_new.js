// data/split_new/ 에 받아 둔 보충 수집분을 라이브 data/split/ 에 합친다.
//
// id 가 이미 있으면 넣지 않는다. 기존 레코드를 덮어쓰지 않는다 —
// 라이브 데이터가 로마자 이름과 정규화를 거친 상태이기 때문이다.
//
//   node merge_split_new.js --dry
//   node merge_split_new.js

const fs = require('fs');
const path = require('path');

const NEW = path.join(__dirname, 'data', 'split_new');
const LIVE = path.join(__dirname, 'data', 'split');
const dry = process.argv.includes('--dry');

if (!fs.existsSync(NEW)) { console.log('data/split_new/ 가 없다'); process.exit(0); }

const STANDARD = ['id', 'name_ko', 'name_en', 'name_th', 'name_vi', 'category',
                  'category_detail', 'address', 'phone', 'map_url', 'x', 'y', 'district'];

let added = 0, dupes = 0, rejected = 0, newFiles = 0, touched = 0;
const perDistrict = {};

for (const region of fs.readdirSync(NEW, { withFileTypes: true })) {
  if (!region.isDirectory()) continue;
  for (const dist of fs.readdirSync(path.join(NEW, region.name), { withFileTypes: true })) {
    if (!dist.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(NEW, region.name, dist.name))) {
      if (!f.endsWith('.json')) continue;

      const src = JSON.parse(fs.readFileSync(path.join(NEW, region.name, dist.name, f), 'utf8'));
      const destPath = path.join(LIVE, region.name, dist.name, f);

      let dest;
      if (fs.existsSync(destPath)) {
        dest = JSON.parse(fs.readFileSync(destPath, 'utf8'));
      } else {
        dest = { region_id: region.name, district: src.district,
                 category: src.category, places_count: 0, places: [] };
        newFiles++;
      }

      const seen = new Set(dest.places.map(p => p.id));
      let n = 0;
      for (const pl of (src.places || [])) {
        if (seen.has(pl.id)) { dupes++; continue; }
        // 표준 스키마가 아닌 레코드는 받지 않는다.
        // 예전에 name/lat/lng 로 들어온 94건 같은 사고를 막는다.
        if (!pl.name_ko || !pl.x || !pl.y || pl.name !== undefined || pl.lat !== undefined) {
          rejected++; continue;
        }
        const ordered = {};
        for (const k of STANDARD) if (pl[k] !== undefined) ordered[k] = pl[k];
        dest.places.push(ordered);
        seen.add(pl.id);
        added++; n++;
      }

      if (n > 0) {
        dest.places_count = dest.places.length;
        touched++;
        const key = region.name + '/' + dist.name;
        perDistrict[key] = (perDistrict[key] || 0) + n;
        if (!dry) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath, JSON.stringify(dest), 'utf8');
        }
      }
    }
  }
}

console.log((dry ? '[미리보기] ' : '') + '추가 ' + added.toLocaleString() + '건');
console.log('  이미 있던 것    ' + dupes.toLocaleString() + '건');
console.log('  스키마 불일치로 거른 것 ' + rejected + '건');
console.log('  새 파일 ' + newFiles + '개 · 수정 파일 ' + touched + '개');
Object.entries(perDistrict).sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log('    ' + k.padEnd(28) + '+' + v + '건'));
if (!dry) console.log('\n다음: node build_size_index.js && node build_map_index.js');
