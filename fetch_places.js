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

const REGIONS = {
  seoul: { minX: 126.76, minY: 37.42, maxX: 127.18, maxY: 37.70 }
};

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

let apiCallCount = 0;
const placesMap = new Map();

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function saveProgress() {
  const placesArr = Array.from(placesMap.values());
  const finalJson = {
    region_id: 'seoul',
    places_count: placesArr.length,
    places: placesArr
  };
  const outPath = path.join(__dirname, 'data', 'region_seoul_new.json');
  fs.writeFileSync(outPath, JSON.stringify(finalJson, null, 2), 'utf-8');
  console.log(`[Save] 현재까지 ${placesArr.length}곳 임시 저장 완료.`);
}

async function fetchKakao(type, queryOrCode, rect, page) {
  apiCallCount++;
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
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// recursion depth 추가하여 무한 분할 방지
async function collect(type, queryOrCode, rect, depth = 0) {
  const results = [];
  for (let page = 1; page <= 3; page++) {
    const data = await fetchKakao(type, queryOrCode, rect, page);
    
    if (data.errorType || data.code === -10) {
      console.error(`API Error: ${JSON.stringify(data)}`);
      if (data.code === -10) {
        console.error("Quota Exceeded! Stopping.");
        saveProgress();
        process.exit(1);
      }
      break;
    }
    
    if (!data.documents || data.documents.length === 0) break;
    results.push(...data.documents);
    
    // 45건 한도 도달 && 분할 깊이가 10(약 0.0004도 차이, 수십 미터) 미만일 때만 쪼갬
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

function addPlace(doc, targetCategory) {
  if (placesMap.has(doc.id)) return;
  
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
    address: doc.road_address_name || doc.address_name,
    phone: doc.phone || '',
    map_url: doc.place_url || `http://place.map.kakao.com/${doc.id}`,
    x: doc.x,
    y: doc.y,
    district: parseDistrict(doc.road_address_name || doc.address_name)
  });
}

function parseDistrict(address) {
  if (!address) return '';
  const match = address.match(/\s+([가-힣]+[구군])/);
  return match ? match[1] : '';
}

async function main() {
  const startTime = Date.now();
  console.log("서울 지역 데이터 수집 시작 (무한 분할 방지 및 저장 추가)...");
  
  const seoulRect = REGIONS.seoul;
  
  for (const cat of CATEGORIES) {
    console.log(`카테고리 수집 중: ${cat.name}`);
    const docs = await collect('category', cat.code, seoulRect);
    for (const d of docs) addPlace(d, cat.name);
    saveProgress();
  }
  
  for (const group of KEYWORDS) {
    for (const kw of group.keywords) {
      console.log(`키워드 수집 중: ${kw} (${group.name})`);
      const docs = await collect('keyword', kw, seoulRect);
      for (const d of docs) addPlace(d, group.name);
      saveProgress();
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("=====================================");
  console.log(`수집 완료! 소요 시간: ${elapsed}초`);
  console.log(`API 호출 횟수: ${apiCallCount}회`);
  console.log(`수집된 고유 장소 수: ${placesMap.size}곳`);
  console.log("=====================================");
}

main();
