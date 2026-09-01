// data/split/_sizeindex.json 을 다시 만든다.
//
// 화면의 "All Categories" 는 그 행정구의 업태 파일을 한꺼번에 받는다.
// 서울 강남구처럼 큰 구는 그 합이 몇 MB 라 모바일에서 기다리게 된다.
// 이 표에 행정구별 합계(KB)를 적어 두고, index.html 이 기준치를 넘는 곳에서는
// "All Categories" 항목 자체를 내보내지 않는다.
//
//   node build_size_index.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'data', 'split');
const OUT = path.join(ROOT, '_sizeindex.json');

const index = {};
let districts = 0, files = 0;

for (const region of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!region.isDirectory()) continue;
  const regionDir = path.join(ROOT, region.name);

  for (const dist of fs.readdirSync(regionDir, { withFileTypes: true })) {
    // unknown 은 드롭다운에 나오지 않으므로 표에 넣지 않는다
    if (!dist.isDirectory() || dist.name === 'unknown') continue;
    const distDir = path.join(regionDir, dist.name);

    let bytes = 0;
    for (const f of fs.readdirSync(distDir)) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      bytes += fs.statSync(path.join(distDir, f)).size;
      files++;
    }
    if (bytes === 0) continue;
    (index[region.name] = index[region.name] || {})[dist.name] = Math.round(bytes / 1024);
    districts++;
  }
}

fs.writeFileSync(OUT, JSON.stringify(index), 'utf8');

const flat = [];
for (const [r, d] of Object.entries(index)) for (const [k, v] of Object.entries(d)) flat.push([r + '/' + k, v]);
flat.sort((a, b) => b[1] - a[1]);

console.log('행정구 ' + districts + '개 · 파일 ' + files + '개 → ' + path.basename(OUT) +
            ' (' + Math.round(fs.statSync(OUT).size / 1024) + 'KB)');
console.log('기준 1500KB — 넘으면 "All Categories" 를 감춘다');
console.log('가장 큰 곳:');
flat.slice(0, 8).forEach(([k, v]) => console.log('  ' + (v > 1500 ? '감춤 ' : '표시 ') + k.padEnd(30) + v + 'KB'));
console.log('감추는 행정구: ' + flat.filter(x => x[1] > 1500).length + '개 / ' + flat.length + '개');
