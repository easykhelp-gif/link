const https = require('https');
const fs = require('fs');
const key = fs.readFileSync('C:/Users/y1611/Desktop/agent/.env','utf8').match(/KAKAO_REST_KEY=([a-zA-Z0-9]+)/)[1];

const coords = [
  {name: 'seoul', x: 126.97, y: 37.56},
  {name: 'busan', x: 129.07, y: 35.17},
  {name: 'daegu', x: 128.60, y: 35.87},
  {name: 'incheon', x: 126.70, y: 37.45},
  {name: 'gwangju', x: 126.85, y: 35.16},
  {name: 'daejeon', x: 127.38, y: 36.35},
  {name: 'ulsan', x: 129.31, y: 35.53},
  {name: 'sejong', x: 127.28, y: 36.48},
  {name: 'gyeonggi', x: 127.00, y: 37.27},
  {name: 'gangwon', x: 127.72, y: 37.88},
  {name: 'chungbuk', x: 127.49, y: 36.63},
  {name: 'chungnam', x: 126.67, y: 36.65},
  {name: 'jeonbuk', x: 127.10, y: 35.82},
  {name: 'jeonnam', x: 126.46, y: 34.81},
  {name: 'gyeongbuk', x: 128.50, y: 36.57},
  {name: 'gyeongnam', x: 128.69, y: 35.23},
  {name: 'jeju', x: 126.49, y: 33.48},
];

async function check() {
  for (const c of coords) {
    await new Promise(res => {
      https.get(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${c.x}&y=${c.y}`, 
        {headers:{'Authorization': 'KakaoAK ' + key}}, r => { 
        let d=''; 
        r.on('data', chunk=>d+=chunk); 
        r.on('end', ()=> {
          try {
            console.log(`${c.name}: ${JSON.parse(d).documents[0].region_1depth_name}`);
          } catch(e) { console.log(c.name, d); }
          res();
        }); 
      });
    });
  }
}
check();
