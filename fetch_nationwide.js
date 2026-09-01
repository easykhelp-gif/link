const https = require('https');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync('C:/Users/y1611/Desktop/agent/.env', 'utf-8');
const match = envContent.match(/KAKAO_REST_KEY=([a-zA-Z0-9]+)/);
if (!match) {
  console.error("No KAKAO_REST_KEY found in .env");
  process.exit(1);
}
const KAKAO_KEY = match[1];

const REGIONS = [
  { id: 'gyeonggi', prefixes: ['경기'], minX: 126.54, minY: 36.89, maxX: 127.84, maxY: 38.29 },
  // 2026-09-01: maxY 를 37.58 → 37.82 로 넓혔다.
  // 검단신도시(37.58~37.65)와 강화군(37.60~37.80)이 격자 밖이라
  // 처음부터 수집 대상이 아니었다. 검단구 21건, 강화군 0건이었던 원인이다.
  { id: 'incheon', prefixes: ['인천'], minX: 126.10, minY: 37.01, maxX: 126.80, maxY: 37.82 },
  { id: 'busan', prefixes: ['부산'], minX: 128.73, minY: 34.87, maxX: 129.31, maxY: 35.39 },
  { id: 'daegu', prefixes: ['대구'], minX: 128.35, minY: 35.59, maxX: 128.87, maxY: 36.01 },
  { id: 'gwangju', prefixes: ['광주'], minX: 126.65, minY: 35.07, maxX: 127.02, maxY: 35.26 },
  { id: 'daejeon', prefixes: ['대전'], minX: 127.26, minY: 36.22, maxX: 127.47, maxY: 36.48 },
  { id: 'ulsan', prefixes: ['울산'], minX: 128.98, minY: 35.33, maxX: 129.46, maxY: 35.65 },
  { id: 'sejong', prefixes: ['세종'], minX: 127.15, minY: 36.43, maxX: 127.42, maxY: 36.73 },
  { id: 'gangwon', prefixes: ['강원'], minX: 127.08, minY: 37.04, maxX: 129.35, maxY: 38.61 },
  { id: 'chungbuk', prefixes: ['충청북도', '충북'], minX: 127.27, minY: 36.01, maxX: 128.63, maxY: 37.25 },
  { id: 'chungnam', prefixes: ['충청남도', '충남'], minX: 125.99, minY: 35.98, maxX: 127.63, maxY: 37.06 },
  { id: 'jeonbuk', prefixes: ['전라북도', '전북', '전북특별자치도'], minX: 125.95, minY: 35.28, maxX: 127.89, maxY: 36.16 },
  { id: 'jeonnam', prefixes: ['전라남도', '전남'], minX: 125.07, minY: 33.95, maxX: 127.91, maxY: 35.49 },
  { id: 'gyeongbuk', prefixes: ['경상북도', '경북'], minX: 127.80, minY: 35.57, maxX: 131.00, maxY: 37.55 }, // 울릉도 포함
  { id: 'gyeongnam', prefixes: ['경상남도', '경남'], minX: 127.58, minY: 34.68, maxX: 129.21, maxY: 35.86 },
  { id: 'jeju', prefixes: ['제주'], minX: 126.15, minY: 33.11, maxX: 126.97, maxY: 34.00 }
];

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

let globalApiCallCount = 0;
let regionApiCallCount = 0;
let placesMap = new Map();
let currentRegion = null;

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function saveProgress(region) {
  const placesArr = Array.from(placesMap.values());
  const finalJson = {
    region_id: region.id,
    places_count: placesArr.length,
    places: placesArr
  };
  const outPath = path.join(__dirname, 'data', `region_${region.id}_new.json`);
  fs.writeFileSync(outPath, JSON.stringify(finalJson, null, 2), 'utf-8');
  console.log(`[Save] ${region.id} 현재까지 ${placesArr.length}곳 임시 저장 완료. (호출횟수: ${regionApiCallCount})`);
}

async function fetchKakao(type, queryOrCode, rect, page) {
  globalApiCallCount++;
  regionApiCallCount++;
  const rectStr = `${rect.minX},${rect.minY},${rect.maxX},${rect.maxY}`;
  let pathUrl = '';
  
  if (type === 'category') {
    pathUrl = `/v2/local/search/category.json?category_group_code=${encodeURIComponent(queryOrCode)}&rect=${rectStr}&size=15&page=${page}`;
  } else {
    pathUrl = `/v2/local/search/keyword.json?query=${encodeURIComponent(queryOrCode)}&rect=${rectStr}&size=15&page=${page}`;
  }
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'dapi.kakao.com', path: pathUrl, method: 'GET',
      headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
    }, (res) => {
      let data = '';
      // 2026-09-01 추가. 이 한 줄이 없으면 한글 한 글자가 청크 경계에 걸릴 때
      // 조각난 바이트가 그대로 문자열에 붙어 주소가 깨진다.
      // 주소가 깨진 채 저장된 671건의 원인이었다.
      res.setEncoding('utf8');
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function collect(type, queryOrCode, rect, depth = 0) {
  const results = [];
  for (let page = 1; page <= 3; page++) {
    const data = await fetchKakao(type, queryOrCode, rect, page);
    
    if (data.errorType || data.code === -10) {
      console.error(`API Error: ${JSON.stringify(data)}`);
      if (data.code === -10) {
        console.error("Quota Exceeded! Stopping safely.");
        saveProgress(currentRegion);
        console.log(`총 소모 쿼터: ${globalApiCallCount}`);
        process.exit(1);
      }
      break;
    }
    
    if (!data.documents || data.documents.length === 0) break;
    results.push(...data.documents);
    
    if (page === 1 && data.meta && data.meta.pageable_count >= 45 && depth < 6) {
      const midX = (rect.minX + rect.maxX) / 2;
      const midY = (rect.minY + rect.maxY) / 2;
      
      const tl = await collect(type, queryOrCode, { minX: rect.minX, minY: midY, maxX: midX, maxY: rect.maxY }, depth + 1);
      const tr = await collect(type, queryOrCode, { minX: midX, minY: midY, maxX: rect.maxX, maxY: rect.maxY }, depth + 1);
      const bl = await collect(type, queryOrCode, { minX: rect.minX, minY: rect.minY, maxX: midX, maxY: midY }, depth + 1);
      const br = await collect(type, queryOrCode, { minX: midX, minY: rect.minY, maxX: rect.maxX, maxY: midY }, depth + 1);
      
      return [...tl, ...tr, ...bl, ...br]; 
    }
    if (data.meta && data.meta.is_end) break;
    await delay(30);
  }
  return results;
}

function addPlace(doc, targetCategory, region) {
  if (placesMap.has(doc.id)) return;
  
  const address = doc.road_address_name || doc.address_name || '';
  if (!address) return;
  
  // 현재 시도에 해당하는 주소만 필터링
  const isMatch = region.prefixes.some(p => address.startsWith(p));
  if (!isMatch) return;
  
  const name = doc.place_name || '';
  if (name.includes('구두병원') || name.includes('동물병원') || name.includes('가방병원')) return;
  
  let cat = targetCategory;
  let finalNameKo = name;
  if (doc.category_name && (doc.category_name.includes('약국') || doc.category_name.includes('한약방'))) {
    cat = 'pharmacy';
    if (!finalNameKo.includes('약국') && !finalNameKo.includes('약방')) {
      finalNameKo += ' (약국)';
    }
  }
  
  placesMap.set(doc.id, {
    id: doc.id,
    name_ko: finalNameKo,
    name_en: '', 
    name_th: '',
    category: cat,
    category_detail: doc.category_name || '',
    address: address,
    phone: doc.phone || '',
    map_url: doc.place_url || `http://place.map.kakao.com/${doc.id}`,
    x: doc.x,
    y: doc.y,
    district: parseDistrict(address)
  });
}

function parseDistrict(address) {
  if (!address) return '';
  const match = address.match(/\s+([가-힣]+[구군시])/); // '시' 추가 (예: 성남시 분당구, 고양시 일산동구)
  return match ? match[1] : '';
}

async function main() {
  const globalStart = Date.now();
  console.log("전국(나머지 16개 시도) 데이터 수집 시작...");
  
  for (const region of REGIONS) {
    currentRegion = region;
    placesMap.clear();
    regionApiCallCount = 0;
    
    const startTime = Date.now();
    console.log(`\n=====================================`);
    console.log(`[${region.id}] 수집 시작`);
    
    for (const cat of CATEGORIES) {
      const docs = await collect('category', cat.code, region);
      for (const d of docs) addPlace(d, cat.name, region);
    }
    saveProgress(region);
    
    for (const group of KEYWORDS) {
      for (const kw of group.keywords) {
        const docs = await collect('keyword', kw, region);
        for (const d of docs) addPlace(d, group.name, region);
      }
      saveProgress(region);
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${region.id}] 완료! 소요: ${elapsed}초 / 호출: ${regionApiCallCount}회 / 건수: ${placesMap.size}곳`);
  }
  
  const totalElapsed = ((Date.now() - globalStart) / 1000).toFixed(1);
  console.log(`\n=====================================`);
  console.log(`전국 수집 최종 완료! 총 소요 시간: ${totalElapsed}초`);
  console.log(`총 누적 API 호출 횟수: ${globalApiCallCount}회`);
}

main();
