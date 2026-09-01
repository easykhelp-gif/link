const fs = require('fs');
const https = require('https');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const kakaoMatch = envContent.match(/KAKAO_REST_KEY=([a-zA-Z0-9]+)/);
const KAKAO_KEY = kakaoMatch[1];

const DATA_FILE = path.join(__dirname, 'data', 'region_jeonnam_gwangju_new.json');
if (!fs.existsSync(DATA_FILE)) {
  fs.copyFileSync(path.join(__dirname, 'data', 'region_jeonnam_new.json'), DATA_FILE);
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const existingIds = new Set(data.places.map(p => p.id));

const CATEGORIES = [
  { code: 'HP8', keyword: '', name: 'hospital' },
  { code: 'PM9', keyword: '', name: 'pharmacy' },
  { code: '', keyword: '미용실', name: 'beauty' },
  { code: '', keyword: '피부관리', name: 'beauty' },
  { code: '', keyword: '네일아트', name: 'beauty' },
  { code: '', keyword: '주민센터', name: 'public' },
  { code: '', keyword: '구청', name: 'public' },
  { code: '', keyword: '출입국사무소', name: 'public' },
  { code: '', keyword: '보건소', name: 'public' }
];

const GWANGJU = { id: 'jeonnam_gwangju', minX: 126.65, minY: 35.07, maxX: 127.02, maxY: 35.26 };

function fetchPage(category, rect, page) {
  return new Promise((resolve, reject) => {
    let url = `https://dapi.kakao.com/v2/local/search/keyword.json?rect=${rect.minX},${rect.minY},${rect.maxX},${rect.maxY}&page=${page}&size=15`;
    if (category.code) url += `&category_group_code=${category.code}`;
    if (category.keyword) url += `&query=${encodeURIComponent(category.keyword)}`;

    https.get(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }, res => {
      let body = '';
      // 2026-09-01 추가. 없으면 한글 한 글자가 청크 경계에 걸릴 때
      // 조각난 바이트가 문자열에 붙어 주소가 깨진다.
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runGwangju() {
  console.log("Fetching Gwangju specific grid...");
  
  let newPlaces = 0;
  
  async function searchGrid(category, rect, depth) {
    let page = 1;
    let isEnd = false;
    let totalCount = 0;
    
    while (!isEnd && page <= 45) {
      const res = await fetchPage(category, rect, page);
      if (!res.meta) break; // error or rate limit
      totalCount = res.meta.total_count;
      isEnd = res.meta.is_end;
      
      for (const doc of res.documents) {
        if (!existingIds.has(doc.id)) {
          existingIds.add(doc.id);
          data.places.push({
            id: doc.id,
            name: doc.place_name,
            name_en: '',
            name_th: '',
            name_vi: '',
            category: category.name,
            category_detail: doc.category_name,
            address: doc.address_name || doc.road_address_name,
            phone: doc.phone,
            lat: doc.y,
            lng: doc.x,
            url: doc.place_url
          });
          newPlaces++;
        }
      }
      
      if (totalCount > 45 * 15 && depth < 6 && page === 45) {
        // Need to split
        const midX = (rect.minX + rect.maxX) / 2;
        const midY = (rect.minY + rect.maxY) / 2;
        await searchGrid(category, {minX: rect.minX, minY: rect.minY, maxX: midX, maxY: midY}, depth+1);
        await searchGrid(category, {minX: midX, minY: rect.minY, maxX: rect.maxX, maxY: midY}, depth+1);
        await searchGrid(category, {minX: rect.minX, minY: midY, maxX: midX, maxY: rect.maxY}, depth+1);
        await searchGrid(category, {minX: midX, minY: midY, maxX: rect.maxX, maxY: rect.maxY}, depth+1);
        return;
      }
      page++;
    }
  }

  for (const cat of CATEGORIES) {
    await searchGrid(cat, GWANGJU, 0);
  }
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Finished Gwangju! Added ${newPlaces} new places.`);
}

runGwangju();
