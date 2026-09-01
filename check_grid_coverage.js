// 수집 격자가 각 시도를 다 덮는지 검증한다.
//
// fetch_nationwide.js 의 시도별 사각형은 손으로 적은 값이다.
// 행정구역이 개편·편입되면 새 지역이 사각형 밖에 놓여 통째로 빠진다.
// 실제로 두 번 일어났다.
//   인천 maxY 37.58  →  검단신도시·강화군 누락
//   대구 maxY 36.01  →  군위군 누락 (2023년 경북에서 편입)
//
// 두 가지를 본다.
//
//  ① 행정구 개수    우리 데이터 vs 2026-09 기준 실제 개수
//                   통째로 빠진 행정구를 찾는다
//  ② 경계 붙음      각 행정구 데이터의 좌표 범위가 격자 경계에 닿아 있는가
//                   닿아 있으면 그 바깥이 잘려 나갔을 수 있다
//
// 외부 호출 없이 우리 데이터만으로 판단한다.
//
//   node check_grid_coverage.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'data', 'split');

// 2026-09-01 기준 시도별 행정구 수
const 공식 = {
  seoul: 25, busan: 16, daegu: 9, incheon: 11, daejeon: 5, ulsan: 5, sejong: 1,
  gyeonggi: 31, gangwon: 18, chungbuk: 11, chungnam: 15, jeonbuk: 14,
  gyeongbuk: 22, gyeongnam: 18, jeju: 2, jeonnam_gwangju: 27
};

// 격자를 fetch_nationwide.js 에서 직접 읽는다. 옮겨 적으면 어긋난다.
const src = fs.readFileSync(path.join(__dirname, 'fetch_nationwide.js'), 'utf8');
const GRID = {};
for (const m of src.matchAll(
  /\{\s*id:\s*'([a-z_]+)'[^}]*?minX:\s*([\d.]+),\s*minY:\s*([\d.]+),\s*maxX:\s*([\d.]+),\s*maxY:\s*([\d.]+)/g)) {
  GRID[m[1]] = { minX: +m[2], minY: +m[3], maxX: +m[4], maxY: +m[5] };
}
// 전남광주통합특별시는 격자에 gwangju / jeonnam 두 개로 남아 있다
const GRID_OF = { jeonnam_gwangju: ['gwangju', 'jeonnam'] };

// 경계에 이만큼 이내로 붙으면 잘렸을 수 있다고 본다 (약 1km)
const EDGE = 0.01;

let missing = 0, clipped = 0, noGrid = [];

console.log('① 행정구 개수\n');
const regions = fs.readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
for (const r of regions.sort()) {
  const have = fs.readdirSync(path.join(ROOT, r), { withFileTypes: true })
    .filter(d => d.isDirectory()).length;
  const want = 공식[r];
  if (want === undefined) { console.log('  ' + r.padEnd(18) + have + '개   (기준값 없음)'); continue; }
  const d = have - want;
  if (d !== 0) missing++;
  console.log('  ' + (d === 0 ? '   ' : '★  ') + r.padEnd(18) +
              String(have).padStart(3) + ' / ' + String(want).padStart(3) +
              (d === 0 ? '' : '   ' + (d > 0 ? '+' : '') + d + '개'));
}

console.log('\n② 데이터가 격자 경계에 붙어 있는가\n');
for (const r of regions.sort()) {
  const boxes = (GRID_OF[r] || [r]).map(k => GRID[k]).filter(Boolean);
  if (!boxes.length) { noGrid.push(r); continue; }

  const hits = [];
  for (const dist of fs.readdirSync(path.join(ROOT, r), { withFileTypes: true })) {
    if (!dist.isDirectory()) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, n = 0, ko = '';
    for (const f of fs.readdirSync(path.join(ROOT, r, dist.name))) {
      if (!f.endsWith('.json')) continue;
      let j; try { j = JSON.parse(fs.readFileSync(path.join(ROOT, r, dist.name, f), 'utf8')); } catch (e) { continue; }
      ko = j.district || ko;
      for (const pl of (j.places || [])) {
        const x = parseFloat(pl.x), y = parseFloat(pl.y);
        if (!isFinite(x) || !isFinite(y)) continue;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        n++;
      }
    }
    if (!n) continue;

    // 어느 격자에도 안 들어가면 그 자체가 문제다
    const box = boxes.find(b => minX >= b.minX - 0.2 && maxX <= b.maxX + 0.2 &&
                                minY >= b.minY - 0.2 && maxY <= b.maxY + 0.2) || boxes[0];
    const touch = [];
    if (Math.abs(minX - box.minX) < EDGE) touch.push('서쪽');
    if (Math.abs(maxX - box.maxX) < EDGE) touch.push('동쪽');
    if (Math.abs(minY - box.minY) < EDGE) touch.push('남쪽');
    if (Math.abs(maxY - box.maxY) < EDGE) touch.push('북쪽');
    if (touch.length) hits.push('  ★ ' + (ko || dist.name).padEnd(10) + n + '건, 격자 ' + touch.join('·') + ' 경계에 붙음');
  }
  clipped += hits.length;
  if (hits.length) { console.log('  [' + r + ']'); hits.forEach(l => console.log(l)); }
}
if (clipped === 0) console.log('  경계에 붙은 행정구 없음');

console.log('\n요약');
console.log('  개수가 안 맞는 시도    ' + missing + '개');
console.log('  격자 경계에 붙은 행정구 ' + clipped + '개');
if (noGrid.length) {
  console.log('  ★ 격자 정의가 없는 시도  ' + noGrid.join(', '));
  console.log('     fetch_nationwide.js 의 REGIONS 에 없다. 다른 스크립트로 수집됐다는 뜻이다.');
}
