const fs = require('fs');
const https = require('https');
const path = require('path');
const { toEnglish } = require('../lib/korean_romanize');

// 1. API Key Load
const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
const KEY = (env.match(/KAKAO_REST_KEY=([a-zA-Z0-9]+)/) || [])[1];
if (!KEY) { console.error('.env 에 KAKAO_REST_KEY 가 없습니다.'); process.exit(1); }

// 2. Data Load
const dataPath = path.join(__dirname, '../안티_재수집대상_주소깨짐_20260901.json');
const items = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 3. Helper functions
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function fetchKakao(query, x, y) {
  const p = `/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&x=${x}&y=${y}&radius=200`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'dapi.kakao.com', path: p, method: 'GET',
      headers: { Authorization: 'KakaoAK ' + KEY }
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function districtOf(address) {
  const m = String(address || '').match(/\s+([가-힣]+[구군시])/);
  return m ? m[1] : '';
}

// 4. Processing
async function run() {
  console.log(`총 ${items.length}건 처리 시작...`);
  
  const bucket = {}; 
  
  let successCount = 0;
  let failCount = 0;
  let regionCounts = {};

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    const parts = item.file.split('/');
    if (parts.length !== 4) {
        console.error(`Invalid file path format: ${item.file}`);
        failCount++;
        continue;
    }
    const region_id = parts[1];
    const district_slug = parts[2];
    const cat = parts[3].replace('.json', '');

    try {
      const data = await fetchKakao(item.name_ko, item.x, item.y);
      if (data.errorType || !data.documents) {
        console.error(`API Error for ${item.name_ko}:`, data);
        failCount++;
        continue;
      }
      
      const place = data.documents.find(d => d.id === item.id);
      
      if (!place) {
        failCount++;
        continue;
      }
      
      const address = place.road_address_name || place.address_name || '';
      const enName = toEnglish(item.name_ko) || '';
      
      const newPlace = {
        id: place.id,
        name_ko: item.name_ko,
        name_en: enName,
        name_th: enName,
        name_vi: enName,
        category: item.category,
        category_detail: place.category_name || '',
        address: address,
        phone: place.phone || '',
        map_url: place.place_url || `http://place.map.kakao.com/${place.id}`,
        x: place.x,
        y: place.y,
        district: districtOf(address)
      };
      
      if (!bucket[region_id]) bucket[region_id] = {};
      if (!bucket[region_id][district_slug]) bucket[region_id][district_slug] = {};
      if (!bucket[region_id][district_slug][cat]) bucket[region_id][district_slug][cat] = [];
      
      bucket[region_id][district_slug][cat].push(newPlace);
      
      successCount++;
      regionCounts[region_id] = (regionCounts[region_id] || 0) + 1;
      
    } catch (err) {
      console.error(`Request failed for ${item.name_ko}: ${err.message}`);
      failCount++;
    }
    
    if (i > 0 && i % 50 === 0) {
        console.log(`Progress: ${i} / ${items.length} (Success: ${successCount}, Fail: ${failCount})`);
    }
    
    await delay(35);
  }

  console.log(`\n데이터 수집 완료. (성공: ${successCount}, 실패: ${failCount})`);
  
  // 5. Save to files
  const OUT_BASE = path.join(__dirname, 'data', 'split_new');
  let filesWritten = 0;
  
  for (const region_id of Object.keys(bucket)) {
      for (const district_slug of Object.keys(bucket[region_id])) {
          for (const cat of Object.keys(bucket[region_id][district_slug])) {
              const list = bucket[region_id][district_slug][cat];
              if (list.length === 0) continue;
              
              const district_ko = list[0].district || district_slug;
              
              const dirPath = path.join(OUT_BASE, region_id, district_slug);
              fs.mkdirSync(dirPath, { recursive: true });
              
              const filePath = path.join(dirPath, cat + '.json');
              const fileData = {
                  region_id: region_id,
                  district: district_ko,
                  category: cat,
                  places_count: list.length,
                  places: list
              };
              
              fs.writeFileSync(filePath, JSON.stringify(fileData), 'utf8');
              filesWritten++;
          }
      }
  }
  
  console.log(`\n${filesWritten}개 파일 쓰기 완료.`);
  console.log('시도별 재수집 성공 건수:');
  console.log(regionCounts);
}

run();
