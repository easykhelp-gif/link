// data/split 안의 비표준 레코드를 표준형으로 맞춘다.
//
// 광주 추가 수집분 94건이 카카오 응답을 그대로 담아 필드 이름이 다르다.
//   name → name_ko    lat/lng → y/x    url → map_url
// name_ko 가 없으면 디렉토리 카드의 제목이 빈 칸으로 나온다.
// 영문·태국어·베트남어 이름은 로마자 라이브러리로 채운다 (외부 호출 없음).
//
//   node normalize_places.js --dry    무엇이 바뀌는지만 본다
//   node normalize_places.js          쓴다

const fs = require('fs');
const path = require('path');
const { toEnglish } = require('../lib/korean_romanize');

const ROOT = path.join(__dirname, 'data', 'split');
const dry = process.argv.includes('--dry');

const STANDARD = ['id', 'name_ko', 'name_en', 'name_th', 'name_vi', 'category',
                  'category_detail', 'address', 'phone', 'map_url', 'x', 'y', 'district'];

let files = 0, touched = 0, fixedKo = 0, fixedNames = 0, fixedCoord = 0, fixedUrl = 0;
const noName = [];

function districtFromPath(p) {
  // data/split/<region>/<district-slug>/<category>.json
  const parts = p.split(path.sep);
  const i = parts.indexOf('split');
  return i >= 0 && parts.length > i + 2 ? parts[i + 2] : '';
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!e.name.endsWith('.json') || e.name.startsWith('_')) continue;
    files++;

    let json;
    try { json = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (err) { console.log('파싱 실패 ' + p + ' — ' + err.message); continue; }
    if (!Array.isArray(json.places)) continue;

    let dirty = false;
    for (const pl of json.places) {
      // 1) 이름
      if (!pl.name_ko && pl.name) { pl.name_ko = pl.name; fixedKo++; dirty = true; }
      if (pl.name !== undefined) { delete pl.name; dirty = true; }

      // 2) 좌표 — 카카오는 x 가 경도, y 가 위도다
      if (!pl.x && pl.lng) { pl.x = String(pl.lng); fixedCoord++; dirty = true; }
      if (!pl.y && pl.lat) { pl.y = String(pl.lat); dirty = true; }
      if (pl.lat !== undefined) { delete pl.lat; dirty = true; }
      if (pl.lng !== undefined) { delete pl.lng; dirty = true; }

      // 3) 지도 링크
      if (!pl.map_url && pl.url) { pl.map_url = pl.url; fixedUrl++; dirty = true; }
      if (pl.url !== undefined) { delete pl.url; dirty = true; }

      // district 는 채우지 않는다.
      // 6,289건이 비어 있지만 화면이 쓰지 않는 필드다. 채우면 파일 37개를
      // 이득 없이 더 건드리게 된다. 필요해지면 그때 따로 돌린다.

      // 4) 외국어 이름 — 비어 있으면 로마자로 채운다
      if (pl.name_ko && !pl.name_en) {
        const en = toEnglish(pl.name_ko);
        if (en) {
          pl.name_en = en;
          if (!pl.name_th) pl.name_th = en;
          if (!pl.name_vi) pl.name_vi = en;
          fixedNames++;
          dirty = true;
        }
      }

      if (!pl.name_ko) noName.push({ file: p, id: pl.id, address: pl.address });

      // 5) 키 순서를 표준에 맞춘다 — 사람이 파일을 열어 볼 때 헷갈리지 않게
      const ordered = {};
      for (const k of STANDARD) if (pl[k] !== undefined) ordered[k] = pl[k];
      for (const k of Object.keys(pl)) if (!(k in ordered)) ordered[k] = pl[k];
      for (const k of Object.keys(pl)) delete pl[k];
      Object.assign(pl, ordered);
    }

    if (dirty) {
      touched++;
      if (!dry) fs.writeFileSync(p, JSON.stringify(json), 'utf8');
    }
  }
}

walk(ROOT);

console.log((dry ? '[미리보기] ' : '') + '파일 ' + files + '개 검사, ' + touched + '개 변경');
console.log('  name → name_ko        ' + fixedKo + '건');
console.log('  외국어 이름 채움       ' + fixedNames + '건');
console.log('  lat/lng → x/y         ' + fixedCoord + '건');
console.log('  url → map_url         ' + fixedUrl + '건');
if (noName.length) {
  console.log('  이름을 채우지 못한 것  ' + noName.length + '건');
  noName.slice(0, 5).forEach(r => console.log('    ' + r.id + '  ' + (r.address || '(주소 없음)')));
}
