// 특정 장소들만 골라 카카오에서 다시 받아온다.
//
// 무엇에 쓰나
//   주소가 깨졌거나, 전화번호가 비었거나, 상호가 바뀐 장소를 고칠 때.
//   fetch_area.js 는 사각형 구역을 통째로 훑는 도구라 "이것들만" 을 못 한다.
//   그 자리를 이 도구가 맡는다.
//
// 어떻게 찾나
//   상호명 + 그 장소의 좌표 반경 200m 로 키워드 검색을 하고,
//   결과에서 id 가 일치하는 것을 고른다.
//
//   실측(2026-09-01, 표본 12건)으로 세 방법을 비교했다.
//     반경 10m 업태검색      6/12   카카오 카테고리 코드가 있는 업태만 된다.
//                                   미용·통신·관공서는 코드가 없어 통째로 실패한다
//     좌표 → 주소 변환       12/12  되지만 주소 형식이 달라진다 ("부산광역시…")
//     상호명 + 반경 200m     12/12  형식도 같고 원본 레코드를 그대로 가져온다  ← 이것
//
//   반경 10m 는 좌표 오차에 걸린다. 200m 를 쓴다.
//
// 쓰는 법
//   node refetch_places.js --broken            주소가 깨진 것을 스스로 찾아서 처리
//   node refetch_places.js --list <파일.json>  목록 파일로 처리
//   node refetch_places.js --broken --dry      무엇을 할지만 본다
//
//   목록 파일 형식 (둘 중 아무 모양이나 된다)
//     [{ id, name_ko, x, y, category, file }]        file = "data/split/<시도>/<구>/<업태>.json"
//     [{ id, name_ko, x, y, category, region, district }]
//
// 결과
//   data/split_new/<시도>/<행정구슬러그>/<업태>.json
//   반영은 apply_address_fix.js (주소만 고칠 때) 또는
//          merge_split_new.js (새 장소를 넣을 때)

const fs = require('fs');
const https = require('https');
const path = require('path');
const { toEnglish } = require('../lib/korean_romanize');

const BASE = __dirname;
const LIVE = path.join(BASE, 'data', 'split');
const OUT = path.join(BASE, 'data', 'split_new');

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const useBroken = argv.includes('--broken');
const listIdx = argv.indexOf('--list');
const listPath = listIdx >= 0 ? argv[listIdx + 1] : null;

if (!useBroken && !listPath) {
  console.error('사용법:\n' +
    '  node refetch_places.js --broken\n' +
    '  node refetch_places.js --list <파일.json>\n' +
    '  ( --dry 를 붙이면 무엇을 할지만 본다 )');
  process.exit(1);
}

const env = fs.readFileSync(path.join(BASE, '..', '.env'), 'utf-8');
const KEY = (env.match(/KAKAO_REST_KEY=([a-zA-Z0-9]+)/) || [])[1];
if (!KEY) { console.error('.env 에 KAKAO_REST_KEY 가 없다'); process.exit(1); }

const RADIUS = 200;
const INTERVAL_MS = 40;
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function fetchKakao(query, x, y) {
  const p = '/v2/local/search/keyword.json?query=' + encodeURIComponent(query) +
            '&x=' + x + '&y=' + y + '&radius=' + RADIUS;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'dapi.kakao.com', path: p, method: 'GET',
      headers: { Authorization: 'KakaoAK ' + KEY }
    }, (res) => {
      let data = '';
      // 이 한 줄이 없으면 한글이 청크 경계에서 깨진다.
      // 주소가 깨진 662건이 정확히 그렇게 생겼다.
      res.setEncoding('utf8');
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(9000, () => { req.destroy(); reject(new Error('시간 초과')); });
    req.end();
  });
}

function districtOf(address) {
  const m = String(address || '').match(/\s+([가-힣]+[구군시])/);
  return m ? m[1] : '';
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

// 대상 모으기 — 목록 파일이 없으면 라이브에서 깨진 것을 직접 찾는다
function collectTargets() {
  if (listPath) {
    const raw = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    return raw.map(r => {
      let region = r.region, district = r.district;
      if (!region && r.file) {
        // "data/split/<시도>/<구>/<업태>.json"
        const parts = String(r.file).replace(/\\/g, '/').split('/');
        const i = parts.indexOf('split');
        if (i >= 0) { region = parts[i + 1]; district = parts[i + 2]; }
      }
      return { id: r.id, name_ko: r.name_ko, x: r.x, y: r.y,
               category: r.category, region, district };
    }).filter(r => r.id && r.name_ko && r.x && r.y && r.region && r.district);
  }

  const out = [];
  walk(LIVE, (p, j) => {
    const parts = p.split(path.sep);
    const i = parts.indexOf('split');
    const region = parts[i + 1], district = parts[i + 2];
    for (const pl of (j.places || [])) {
      if (!/�/.test(pl.address || '')) continue;
      if (!pl.id || !pl.name_ko || !pl.x || !pl.y) continue;
      out.push({ id: pl.id, name_ko: pl.name_ko, x: pl.x, y: pl.y,
                 category: pl.category, region, district });
    }
  });
  return out;
}

(async () => {
  const items = collectTargets();
  console.log((listPath ? '목록 파일' : '라이브에서 찾은 깨진 주소') + ' — 대상 ' + items.length + '건');
  if (!items.length) { console.log('할 것이 없다.'); return; }
  if (dry) {
    const by = {};
    items.forEach(r => { by[r.region] = (by[r.region] || 0) + 1; });
    console.log('  시도별: ' + Object.entries(by).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => k + ' ' + v).join(' · '));
    console.log('  예상 호출 ' + items.length + '회 · 약 ' +
      Math.ceil(items.length * INTERVAL_MS / 60000) + '분');
    console.log('[미리보기] 실제 호출은 하지 않았다.');
    return;
  }

  const bucket = {};
  let ok = 0, notFound = 0, failed = 0, stillBroken = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    try {
      const data = await fetchKakao(it.name_ko, it.x, it.y);
      if (data.errorType || !data.documents) { failed++; continue; }

      const place = data.documents.find(d => d.id === it.id);
      if (!place) { notFound++; continue; }

      const address = place.road_address_name || place.address_name || '';
      // 받아온 주소가 여전히 깨져 있으면 쓰지 않는다
      if (!address || /�/.test(address)) { stillBroken++; continue; }

      const en = toEnglish(it.name_ko) || '';
      const rec = {
        id: place.id,
        name_ko: it.name_ko,
        name_en: en, name_th: en, name_vi: en,
        category: it.category,
        category_detail: place.category_name || '',
        address,
        phone: place.phone || '',
        map_url: place.place_url || 'http://place.map.kakao.com/' + place.id,
        x: place.x, y: place.y,
        district: districtOf(address)
      };

      const cat = it.category || 'etc';
      ((bucket[it.region] = bucket[it.region] || {})[it.district] =
        bucket[it.region][it.district] || {});
      (bucket[it.region][it.district][cat] =
        bucket[it.region][it.district][cat] || []).push(rec);
      ok++;
    } catch (e) {
      failed++;
    }
    if (i > 0 && i % 100 === 0) {
      console.log('  ' + i + ' / ' + items.length + '   성공 ' + ok);
    }
    await delay(INTERVAL_MS);
  }

  // 저장
  let files = 0;
  for (const [region, dists] of Object.entries(bucket)) {
    for (const [district, cats] of Object.entries(dists)) {
      for (const [cat, list] of Object.entries(cats)) {
        const dir = path.join(OUT, region, district);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, cat + '.json'),
          JSON.stringify({ region_id: region, district: list[0].district,
                           category: cat, places_count: list.length, places: list }), 'utf8');
        files++;
      }
    }
  }

  console.log('\n성공 ' + ok + ' · 반경 안에서 못 찾음 ' + notFound +
              ' · 받아온 주소가 여전히 깨짐 ' + stillBroken + ' · 요청 실패 ' + failed);
  console.log('파일 ' + files + '개 → data/split_new/');
  console.log('\n다음');
  console.log('  주소만 고치는 경우   node apply_address_fix.js --dry  →  node apply_address_fix.js');
  console.log('  새 장소를 넣는 경우   node merge_split_new.js --dry   →  node merge_split_new.js');
  console.log('  그다음               node build_size_index.js && node build_map_index.js');
})();
