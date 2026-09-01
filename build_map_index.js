// data/split/<시도>/map_index.json 을 실제 데이터에서 다시 만든다.
//
// split_json.js 가 처음 쪼갤 때 같이 써 둔 파일인데, 그 뒤 데이터가 여러 번
// 바뀌는 동안 갱신되지 않았다. 깨진 행정구 이름("▨평구", 1건)이 그대로 남아
// 있고 건수도 지금과 다르다.
//
// index.html 세 언어 모두 이 파일을 읽지 않는다. 지금은 쓰이지 않지만,
// 틀린 채로 두면 나중에 쓰는 쪽이 틀린 값을 믿게 된다.
//
//   node build_map_index.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'data', 'split');
let regions = 0, dropped = 0;

for (const region of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!region.isDirectory()) continue;
  const regionDir = path.join(ROOT, region.name);

  const counts = {};
  let total = 0;

  for (const dist of fs.readdirSync(regionDir, { withFileTypes: true })) {
    if (!dist.isDirectory()) continue;
    const distDir = path.join(regionDir, dist.name);

    for (const f of fs.readdirSync(distDir)) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      let j;
      try { j = JSON.parse(fs.readFileSync(path.join(distDir, f), 'utf8')); }
      catch (e) { continue; }
      const n = (j.places || []).length;
      // 화면에 나오는 이름은 JSON 안의 한글 행정구명이다
      const ko = j.district || dist.name;
      counts[ko] = (counts[ko] || 0) + n;
      total += n;
    }
  }

  const before = path.join(regionDir, 'map_index.json');
  let oldCount = 0;
  if (fs.existsSync(before)) {
    try { oldCount = (JSON.parse(fs.readFileSync(before, 'utf8')).districts || []).length; }
    catch (e) { /* 무시 */ }
  }

  const districts = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  fs.writeFileSync(before,
    JSON.stringify({ region_id: region.name, total_places: total, districts }), 'utf8');

  if (oldCount > districts.length) dropped += oldCount - districts.length;
  console.log('  ' + region.name.padEnd(18) + districts.length + '개 구 · ' +
              total.toLocaleString() + '건' +
              (oldCount !== districts.length ? '   (이전 ' + oldCount + '개 구)' : ''));
  regions++;
}

console.log('시도 ' + regions + '개 갱신, 없어진 항목 ' + dropped + '개');
