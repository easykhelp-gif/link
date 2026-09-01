// unknown 에 남은 항목을 좌표로 확정한다.
//
// recover_unknown.js 가 주소 문자열만으로 116건을 되돌렸고, 후보가 둘 이상이라
// 손대지 않은 9건이 남았다. 이 항목들은 좌표가 멀쩡하므로 카카오
// coord2regioncode 로 행정구를 확정할 수 있다.
//
// 확정된 행정구가 그 시도에 실제로 있는 폴더일 때만 옮긴다.
//
//   node resolve_ambiguous.js --dry
//   node resolve_ambiguous.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync('C:/Users/y1611/Desktop/agent/.env', 'utf-8');
const m = env.match(/KAKAO_REST_KEY=([a-zA-Z0-9]+)/);
if (!m) { console.error('.env 에 KAKAO_REST_KEY 가 없다'); process.exit(1); }
const KEY = m[1];

const ROOT = path.join(__dirname, 'data', 'split');
const dry = process.argv.includes('--dry');

function coord2region(x, y) {
  return new Promise((resolve) => {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${x}&y=${y}`;
    https.get(url, { headers: { Authorization: 'KakaoAK ' + KEY } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          const doc = (j.documents || []).find(d => d.region_type === 'B') || (j.documents || [])[0];
          resolve(doc ? { d1: doc.region_1depth_name, d2: doc.region_2depth_name } : null);
        } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// 그 시도에 실제로 있는 행정구 폴더 목록
function districtsOf(region) {
  const dir = path.join(ROOT, region);
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'unknown') continue;
    for (const f of fs.readdirSync(path.join(dir, e.name))) {
      if (!f.endsWith('.json')) continue;
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, e.name, f), 'utf8'));
        if (j.district) { out.push({ slug: e.name, ko: j.district }); break; }
      } catch (err) { /* 다음 파일 */ }
    }
  }
  return out;
}

(async () => {
  const moves = [];
  const failed = [];

  for (const region of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!region.isDirectory()) continue;
    const unknownDir = path.join(ROOT, region.name, 'unknown');
    if (!fs.existsSync(unknownDir)) continue;

    const districts = districtsOf(region.name);

    for (const f of fs.readdirSync(unknownDir)) {
      if (!f.endsWith('.json')) continue;
      const srcPath = path.join(unknownDir, f);
      const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
      const keep = [];

      for (const pl of (src.places || [])) {
        if (!pl.x || !pl.y) { keep.push(pl); failed.push({ pl, why: '좌표 없음' }); continue; }

        const r = await coord2region(pl.x, pl.y);
        await new Promise(s => setTimeout(s, 120));   // 초당 호출 제한을 넘기지 않는다

        if (!r || !r.d2) { keep.push(pl); failed.push({ pl, why: '조회 실패' }); continue; }

        // 카카오가 준 행정구가 우리 폴더에 있는지 확인한다.
        // 없으면 옮길 곳이 없으므로 손대지 않는다.
        const hit = districts.find(d => d.ko === r.d2);
        if (!hit) { keep.push(pl); failed.push({ pl, why: '폴더 없음: ' + r.d1 + ' ' + r.d2 }); continue; }

        const parts = String(pl.address).split(/\s+/);
        const before = pl.address;
        parts[1] = hit.ko;
        pl.address = parts.join(' ');
        pl.district = hit.ko;

        moves.push({ before, after: pl.address, dest: path.join(ROOT, region.name, hit.slug, f), pl });
      }

      if (!dry) {
        const remaining = src.places.filter(p => keep.includes(p));
        src.places = remaining;
        src.places_count = remaining.length;
        if (remaining.length === 0) fs.unlinkSync(srcPath);
        else fs.writeFileSync(srcPath, JSON.stringify(src), 'utf8');
      }
    }
  }

  // 옮기기
  let added = 0, dupes = 0;
  if (!dry) {
    const byDest = {};
    for (const mv of moves) (byDest[mv.dest] = byDest[mv.dest] || []).push(mv.pl);
    for (const [dest, list] of Object.entries(byDest)) {
      let json = fs.existsSync(dest)
        ? JSON.parse(fs.readFileSync(dest, 'utf8'))
        : { region_id: dest.split(path.sep).slice(-3)[0], district: list[0].district,
            category: path.basename(dest, '.json'), places_count: 0, places: [] };
      const seen = new Set(json.places.map(p => p.id));
      for (const pl of list) {
        if (seen.has(pl.id)) { dupes++; continue; }
        json.places.push(pl); seen.add(pl.id); added++;
      }
      json.places_count = json.places.length;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, JSON.stringify(json), 'utf8');
    }
    // 빈 unknown 폴더 정리
    for (const region of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!region.isDirectory()) continue;
      const u = path.join(ROOT, region.name, 'unknown');
      if (fs.existsSync(u) && fs.readdirSync(u).length === 0) fs.rmdirSync(u);
    }
  }

  console.log((dry ? '[미리보기] ' : '') + '확정 ' + moves.length + '건' +
              (dry ? '' : ' → 편입 ' + added + '건, 중복 제외 ' + dupes + '건'));
  moves.forEach(mv => console.log('  ' + mv.before + '   →   ' + mv.after));
  if (failed.length) {
    console.log('확정 못 함 ' + failed.length + '건');
    failed.forEach(f => console.log('  ' + f.pl.address + '   (' + f.why + ')'));
  }
})();
