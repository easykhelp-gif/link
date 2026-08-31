const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const splitDir = path.join(dataDir, 'split');

if (!fs.existsSync(splitDir)) {
  fs.mkdirSync(splitDir, { recursive: true });
}

// Remove old unknown, jeonnam, gwangju dirs to avoid residue
const dirsToClean = ['jeonnam', 'gwangju', 'seoul', 'gyeonggi'];
dirsToClean.forEach(d => {
  const dp = path.join(splitDir, d);
  if (fs.existsSync(dp)) {
    fs.rmSync(dp, { recursive: true, force: true });
  }
});

const FILES = fs.readdirSync(dataDir).filter(f => f.startsWith('region_') && f.endsWith('_new.json'));

const prefixToRegion = {
  '서울': 'seoul',
  '부산': 'busan',
  '대구': 'daegu',
  '인천': 'incheon',
  '전남광주통합특별시': 'jeonnam_gwangju',
  '대전': 'daejeon',
  '울산': 'ulsan',
  '세종': 'sejong',
  '경기': 'gyeonggi',
  '강원': 'gangwon',
  '충북': 'chungbuk',
  '충청북도': 'chungbuk',
  '충남': 'chungnam',
  '충청남도': 'chungnam',
  '전북': 'jeonbuk',
  '전라북도': 'jeonbuk',
  '경북': 'gyeongbuk',
  '경상북도': 'gyeongbuk',
  '경남': 'gyeongnam',
  '경상남도': 'gyeongnam',
  '제주': 'jeju'
};

function getRegionId(address) {
  for (const [prefix, id] of Object.entries(prefixToRegion)) {
    if (address.startsWith(prefix)) return id;
  }
  return 'unknown';
}

function parseDistrict(address) {
  if (address.startsWith('세종')) return '세종시';
  
  const parts = address.split(' ');
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.endsWith('구') || part.endsWith('시') || part.endsWith('군')) {
      return part;
    }
  }
  return '알수없음';
}

async function splitData() {
  console.log("JSON 분할 스크립트 시작 (주소 기반 라우팅)...");
  
  const allSplitMap = {};
  const allDistrictCounts = {};

  for (const file of FILES) {
    const filePath = path.join(dataDir, file);
    console.log(`[읽는중] ${file}...`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    for (const place of data.places) {
      const addr = place.address || '';
      const actualRegion = getRegionId(addr);
      
      if (actualRegion === 'unknown') {
        // Skip completely unknown addresses to keep it clean, though we could place them in unknown
        continue;
      }
      
      const dist = parseDistrict(addr);
      const cat = place.category || '기타';
      
      if (!allSplitMap[actualRegion]) {
        allSplitMap[actualRegion] = {};
        allDistrictCounts[actualRegion] = {};
      }
      if (!allSplitMap[actualRegion][dist]) {
        allSplitMap[actualRegion][dist] = {};
        allDistrictCounts[actualRegion][dist] = 0;
      }
      if (!allSplitMap[actualRegion][dist][cat]) {
        allSplitMap[actualRegion][dist][cat] = [];
      }
      
      allSplitMap[actualRegion][dist][cat].push(place);
      allDistrictCounts[actualRegion][dist]++;
    }
  }
  
  for (const region of Object.keys(allSplitMap)) {
    const regionDir = path.join(splitDir, region);
    if (!fs.existsSync(regionDir)) fs.mkdirSync(regionDir, { recursive: true });
    
    for (const dist of Object.keys(allSplitMap[region])) {
      const distDir = path.join(regionDir, dist);
      if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
      
      for (const cat of Object.keys(allSplitMap[region][dist])) {
        const catFile = path.join(distDir, `${cat}.json`);
        const outData = {
          region_id: region,
          district: dist,
          category: cat,
          places_count: allSplitMap[region][dist][cat].length,
          places: allSplitMap[region][dist][cat]
        };
        fs.writeFileSync(catFile, JSON.stringify(outData), 'utf-8');
      }
    }
    
    // index metadata
    let totalPlaces = 0;
    const districtArray = [];
    for (const d of Object.keys(allDistrictCounts[region])) {
      totalPlaces += allDistrictCounts[region][d];
      districtArray.push({ name: d, count: allDistrictCounts[region][d] });
    }
    
    const indexData = {
      region_id: region,
      total_places: totalPlaces,
      districts: districtArray
    };
    fs.writeFileSync(path.join(regionDir, 'map_index.json'), JSON.stringify(indexData, null, 2), 'utf-8');
  }
  
  console.log("모든 데이터 분할 완료!");
}

splitData();
