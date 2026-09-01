// 인천 북부 보충 수집.
//
// fetch_nationwide.js 의 인천 격자는 maxY 가 37.58 이다.
//   검단신도시  37.58 ~ 37.65
//   강화군      37.60 ~ 37.80
// 두 곳 모두 격자 밖이라 처음부터 수집 대상이 아니었다.
// 그래서 검단구가 21건, 강화군은 폴더조차 없다.
//
// 여기서는 빠진 띠(위도 37.55~37.82)만 걷는다.
//
// 원본 수집기의 결함 하나를 같이 고쳤다.
//   res.on('data', d => data += d)   ← setEncoding 이 없다
// 한글 한 글자가 청크 경계에 걸리면 조각난 바이트가 문자열로 붙어 깨진다.
// 주소가 깨진 671건의 원인이다. 여기서는 res.setEncoding('utf8') 을 쓴다.
//
// 결과는 data/split_new/incheon/ 에 표준 스키마로 쓴다. 병합은 따로 한다.
//
//   node fetch_incheon_north.js

const https = require('https');
const fs = require('fs');
const path = require('path');
const { toEnglish } = require('../lib/korean_romanize');

const env = fs.readFileSync('C:/Users/y1611/Desktop/agent/.env', 'utf-8');
const KEY = (env.match(/KAKAO_REST_KEY=([a-zA-Z0-9]+)/) || [])[1];
if (!KEY) { console.error('.env 에 KAKAO_REST_KEY 가 없다'); process.exit(1); }

// 빠진 띠. 서쪽은 강화도 서단, 동쪽은 김포 경계 직전까지.
const AREA = { minX: 126.10, minY: 37.55, maxX: 126.80, maxY: 37.82 };

const CATEGORIES = [
  { code: 'HP8', name: 'hospital' },
  { code: 'PM9', name: 'pharmacy' },
  { code: 'BK9', name: 'finance' },
  { code: 'MT1', name: 'restaurant' }
];
const KEYWORDS = [
  { keywords: ['미용실', '헤어샵', '바버샵', '네일'], name: 'beauty' },
  { keywords: ['휴대폰 대리점', '스마트폰 수리', '알뜰폰'], name: 'mobile' },
  { keywords: ['출입국외국인청', '출입국관리사무소', '동주민센터'], name: 'government' },
  { keywords: ['외국인노동자지원센터', '다문화가족지원센터', '글로벌빌리지센터'], name: 'support' }
];

let calls = 0;
const places = new Map();
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function fetchKakao(type, q, rect, page) {
  calls++;
  const rectStr = `${rect.minX},${rect.minY},${rect.maxX},${rect.maxY}`;
  const p = type === 'category'
    ? `/v2/local/search/category.json?category_group_code=${encodeURIComponent(q)}&rect=${rectStr}&size=15&page=${page}`
    : `/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&rect=${rectStr}&size=15&page=${page}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'dapi.kakao.com', path: p, method: 'GET',
      headers: { Authorization: 'KakaoAK ' + KEY }
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');          // ← 원본에 빠져 있던 한 줄
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

// 한 사각형에서 45건(15×3쪽)이 꽉 차면 더 있다는 뜻이므로 넷으로 쪼갠다
async function collect(type, q, rect, depth = 0) {
  const out = [];
  for (let page = 1; page <= 3; page++) {
    let data;
    try { data = await fetchKakao(type, q, rect, page); }
    catch (e) { console.error('  요청 실패: ' + e.message); break; }

    if (data.code === -10) { console.error('할당량 초과. 중단한다.'); save(); process.exit(1); }
    if (data.errorType) { console.error('  API 오류: ' + JSON.stringify(data).slice(0, 120)); break; }
    if (!data.documents || data.documents.length === 0) break;

    out.push(...data.documents);

    if (page === 1 && data.meta && data.meta.pageable_count >= 45 && depth < 6) {
      const mx = (rect.minX + rect.maxX) / 2;
      const my = (rect.minY + rect.maxY) / 2;
      const quads = [
        { minX: rect.minX, minY: my, maxX: mx, maxY: rect.maxY },
        { minX: mx, minY: my, maxX: rect.maxX, maxY: rect.maxY },
        { minX: rect.minX, minY: rect.minY, maxX: mx, maxY: my },
        { minX: mx, minY: rect.minY, maxX: rect.maxX, maxY: my }
      ];
      const sub = [];
      for (const r of quads) sub.push(...await collect(type, q, r, depth + 1));
      return sub;
    }
    if (data.meta && data.meta.is_end) break;
    await delay(35);
  }
  return out;
}

function districtOf(address) {
  const m = String(address || '').match(/\s+([가-힣]+[구군시])/);
  return m ? m[1] : '';
}

function add(doc, category) {
  if (places.has(doc.id)) return;
  const address = doc.road_address_name || doc.address_name || '';
  if (!address.startsWith('인천')) return;          // 김포·서울이 섞이지 않게
  const name = doc.place_name || '';
  if (!name) return;
  if (/구두병원|동물병원|가방병원/.test(name)) return;

  let cat = category;
  let nameKo = name;
  if (doc.category_name && /약국|한약방/.test(doc.category_name)) {
    cat = 'pharmacy';
    if (!/약국|약방/.test(nameKo)) nameKo += ' (약국)';
  }

  const en = toEnglish(nameKo) || '';
  places.set(doc.id, {
    id: doc.id,
    name_ko: nameKo,
    name_en: en,
    name_th: en,
    name_vi: en,
    category: cat,
    category_detail: doc.category_name || '',
    address,
    phone: doc.phone || '',
    map_url: doc.place_url || 'http://place.map.kakao.com/' + doc.id,
    x: doc.x,
    y: doc.y,
    district: districtOf(address)
  });
}

function save() {
  const OUT = path.join(__dirname, 'data', 'split_new', 'incheon');
  fs.mkdirSync(OUT, { recursive: true });

  const bucket = {};
  for (const pl of places.values()) {
    if (!pl.district) continue;
    (bucket[pl.district] = bucket[pl.district] || {});
    (bucket[pl.district][pl.category] = bucket[pl.district][pl.category] || []).push(pl);
  }

  // 폴더명은 라이브와 같은 슬러그를 쓴다
  const slugmap = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'split', '_slugmap.json'), 'utf8'));
  const known = slugmap.incheon || {};
  const EXTRA = { '강화군': 'ganghwa-gun' };

  let files = 0, total = 0;
  console.log('\n행정구별 결과');
  for (const [ko, cats] of Object.entries(bucket).sort()) {
    const slug = known[ko] || EXTRA[ko];
    if (!slug) { console.log('  ' + ko.padEnd(10) + '슬러그 없음 — 건너뜀'); continue; }
    let n = 0;
    for (const [cat, list] of Object.entries(cats)) {
      fs.mkdirSync(path.join(OUT, slug), { recursive: true });
      fs.writeFileSync(path.join(OUT, slug, cat + '.json'),
        JSON.stringify({ region_id: 'incheon', district: ko, category: cat,
                         places_count: list.length, places: list }), 'utf8');
      files++; n += list.length;
    }
    total += n;
    console.log('  ' + ko.padEnd(10) + String(n).padStart(6) + '건  ' + Object.keys(cats).sort().join(','));
  }
  console.log('파일 ' + files + '개 · ' + total.toLocaleString() + '건 → data/split_new/incheon/');
  console.log('API 호출 ' + calls + '회');
}

(async () => {
  console.log('인천 북부 보충 수집 — 위도 ' + AREA.minY + ' ~ ' + AREA.maxY);
  console.log('(기존 격자는 37.58 에서 끊겨 검단·강화가 빠져 있었다)\n');

  for (const c of CATEGORIES) {
    const before = places.size;
    const docs = await collect('category', c.code, AREA);
    docs.forEach(d => add(d, c.name));
    console.log('  ' + c.name.padEnd(12) + '수집 ' + docs.length + '건 → 신규 ' + (places.size - before) + '건  (누적호출 ' + calls + ')');
  }
  for (const k of KEYWORDS) {
    const before = places.size;
    for (const q of k.keywords) {
      const docs = await collect('keyword', q, AREA);
      docs.forEach(d => add(d, k.name));
    }
    console.log('  ' + k.name.padEnd(12) + '신규 ' + (places.size - before) + '건  (누적호출 ' + calls + ')');
  }

  save();

  const broken = [...places.values()].filter(p => /\uFFFD/.test(p.address)).length;
  console.log('주소 깨짐: ' + broken + '건' + (broken === 0 ? '  (setEncoding 수정이 먹혔다)' : '  ★확인 필요'));
})();
