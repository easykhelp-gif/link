// 장소 검색용 낱말 사전을 만든다.
//
// 왜 필요한가
//   포털은 시도 → 구 → 업태를 차례로 골라야 목록이 나온다. 23만 건을 그렇게
//   넘겨 가며 찾는 건 어렵다. 검색창 하나로 끝내려면, 사용자가 친 말이
//   시도인지 구인지 동인지 업태인지 판정할 사전이 있어야 한다.
//
// 어떻게 쓰이나
//   "대구 달서구 상인동 약국"  →  daegu / dalseo-gu / pharmacy / 상인동
//   그러면 data/split/daegu/dalseo-gu/pharmacy.json 하나만 받아
//   그 안에서 주소에 "상인동" 이 든 것만 고르면 된다.
//   폴더 구조가 이미 색인이라 23만 건을 다 뒤질 필요가 없다.
//
// 로마자 표기
//   「국어의 로마자 표기법」(문화체육관광부고시 제2024-27호) 제5항에 따라
//   행정 구역 단위 앞에 붙임표를 넣는다. "상인동" → "Sangin-dong".
//   같은 항이 "붙임표 앞뒤에서 일어나는 음운 변화는 표기에 반영하지 않는다"
//   고 하므로, 단위를 뗀 앞부분만 변환한 뒤 단위를 붙인다.
//
//   node build_search_dict.js
//   → data/search_dict.json

const fs = require('fs');
const path = require('path');
const { romanizeHangul } = require('../lib/korean_romanize');

const ROOT = path.join(__dirname, 'data', 'split');
const OUT = path.join(__dirname, 'data', 'search_dict.json');

// 고시 제5항의 행정 구역 단위. 긴 것부터 봐야 "시" 가 "특별시" 를 먹지 않는다.
const UNITS = ['특별자치도', '특별자치시', '광역시', '특별시', '자치구',
               '동', '읍', '면', '리', '가', '구', '군', '시', '도'];
const UNIT_ROMAN = { '동': 'dong', '읍': 'eup', '면': 'myeon', '리': 'ri', '가': 'ga',
                     '구': 'gu', '군': 'gun', '시': 'si', '도': 'do' };

const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

// "상인동" → "Sangin-dong"
function rr(name) {
  for (const u of ['동', '읍', '면', '리', '가', '구', '군', '시', '도']) {
    if (name.length > 1 && name.endsWith(u)) {
      const stem = name.slice(0, -1);
      return cap(romanizeHangul(stem)) + '-' + UNIT_ROMAN[u];
    }
  }
  return cap(romanizeHangul(name));
}

// ── 시도. 태국어·베트남어는 손으로 적는다 (230개 구까지는 로마자로 친다)
const REGIONS = [
  ['seoul',            '서울', 'Seoul',     'โซล',       'Seoul'],
  ['busan',            '부산', 'Busan',     'ปูซาน',      'Busan'],
  ['daegu',            '대구', 'Daegu',     'แทกู',       'Daegu'],
  ['incheon',          '인천', 'Incheon',   'อินชอน',     'Incheon'],
  ['daejeon',          '대전', 'Daejeon',   'แทจอน',      'Daejeon'],
  ['ulsan',            '울산', 'Ulsan',     'อุลซัน',      'Ulsan'],
  ['sejong',           '세종', 'Sejong',    'เซจง',       'Sejong'],
  ['gyeonggi',         '경기', 'Gyeonggi',  'คยองกี',     'Gyeonggi'],
  ['gangwon',          '강원', 'Gangwon',   'คังวอน',     'Gangwon'],
  ['chungbuk',         '충북', 'Chungbuk',  'ชุงบุก',      'Chungbuk'],
  ['chungnam',         '충남', 'Chungnam',  'ชุงนัม',      'Chungnam'],
  ['jeonbuk',          '전북', 'Jeonbuk',   'ชอนบุก',     'Jeonbuk'],
  ['jeonnam_gwangju',  '전남', 'Jeonnam',   'ชอนนัม',     'Jeonnam'],
  ['gyeongbuk',        '경북', 'Gyeongbuk', 'คยองบุก',    'Gyeongbuk'],
  ['gyeongnam',        '경남', 'Gyeongnam', 'คยองนัม',    'Gyeongnam'],
  ['jeju',             '제주', 'Jeju',      'เชจู',        'Jeju'],
];
// 같은 시도를 부르는 다른 말들
const REGION_ALIAS = {
  seoul: ['서울특별시', 'seoul-si'],
  busan: ['부산광역시'], daegu: ['대구광역시'], incheon: ['인천광역시'],
  daejeon: ['대전광역시'], ulsan: ['울산광역시'],
  sejong: ['세종특별자치시'],
  gyeonggi: ['경기도'], gangwon: ['강원도', '강원특별자치도'],
  chungbuk: ['충청북도'], chungnam: ['충청남도'],
  jeonbuk: ['전라북도', '전북특별자치도'],
  jeonnam_gwangju: ['전라남도', '광주', 'Gwangju', 'กวางจู', '광주광역시', '전남광주통합특별시'],
  gyeongbuk: ['경상북도'], gyeongnam: ['경상남도'],
  jeju: ['제주도', '제주특별자치도'],
};

// ── 업태. 파일 이름이 아니라 실제 내용 기준으로 낱말을 붙인다.
//    restaurant 파일에 든 것은 식당이 아니라 마트·슈퍼다 (하나로마트 2,085건).
const CATEGORIES = {
  hospital: {
    ko: ['병원', '의원', '클리닉', '진료소'],
    en: ['hospital', 'clinic', 'medical', 'doctor', 'health'],
    th: ['โรงพยาบาล', 'คลินิก', 'หมอ'],
    vi: ['bệnh viện', 'phòng khám', 'bác sĩ'],
  },
  pharmacy: {
    ko: ['약국', '약'],
    en: ['pharmacy', 'drugstore', 'chemist', 'medicine'],
    th: ['ร้านขายยา', 'ยา', 'เภสัช'],
    vi: ['nhà thuốc', 'hiệu thuốc', 'thuốc'],
  },
  beauty: {
    ko: ['미용실', '미용', '헤어', '이발소', '이발', '네일', '바버샵'],
    en: ['beauty', 'salon', 'hair', 'barber', 'nail', 'haircut'],
    th: ['ร้านเสริมสวย', 'ทำผม', 'ตัดผม', 'ร้านตัดผม', 'เล็บ'],
    vi: ['tiệm tóc', 'làm tóc', 'cắt tóc', 'salon', 'làm móng'],
  },
  finance: {
    ko: ['은행', '금융', '현금인출기', '환전', '송금', '금고'],
    en: ['bank', 'atm', 'finance', 'exchange', 'remittance', 'money', 'transfer'],
    th: ['ธนาคาร', 'เอทีเอ็ม', 'แลกเงิน', 'โอนเงิน', 'ตู้เอทีเอ็ม'],
    vi: ['ngân hàng', 'atm', 'đổi tiền', 'chuyển tiền', 'gửi tiền'],
  },
  government: {
    ko: ['관공서', '주민센터', '행정복지센터', '구청', '시청', '출입국', '동사무소'],
    en: ['government', 'office', 'immigration', 'city hall', 'community center', 'public'],
    th: ['ราชการ', 'สำนักงาน', 'ตรวจคนเข้าเมือง', 'ตม', 'เขต'],
    vi: ['cơ quan', 'hành chính', 'xuất nhập cảnh', 'ủy ban', 'phường'],
  },
  mobile: {
    ko: ['휴대폰', '핸드폰', '통신', '유심', '폰', '스마트폰'],
    en: ['mobile', 'phone', 'sim', 'telecom', 'smartphone', 'cellphone'],
    th: ['มือถือ', 'โทรศัพท์', 'ซิม', 'ซิมการ์ด'],
    vi: ['điện thoại', 'di động', 'sim', 'sim card'],
  },
  restaurant: {   // 파일 이름은 restaurant 이지만 내용은 마트·슈퍼다
    ko: ['마트', '슈퍼', '대형마트', '식료품', '장보기', '하나로마트'],
    en: ['mart', 'market', 'supermarket', 'grocery', 'store', 'asian market'],
    th: ['ตลาด', 'ซุปเปอร์', 'ห้าง', 'ร้านขายของ', 'ซูเปอร์มาร์เก็ต'],
    vi: ['siêu thị', 'chợ', 'cửa hàng', 'tạp hóa'],
  },
  support: {
    ko: ['지원센터', '상담', '복지', '외국인지원'],
    en: ['support', 'center', 'counseling', 'welfare', 'help'],
    th: ['ศูนย์', 'ช่วยเหลือ', 'ปรึกษา', 'สวัสดิการ'],
    vi: ['trung tâm', 'hỗ trợ', 'tư vấn', 'phúc lợi'],
  },
  public: {
    ko: ['보건소', '보건지소', '공공'],
    en: ['health center', 'public health'],
    th: ['สาธารณสุข', 'ศูนย์อนามัย'],
    vi: ['trạm y tế', 'y tế công'],
  },
};

// ── 세부 업태. 데이터에 실제로 있는 것 중 자주 찾을 것들만.
//    "대구 달서구 치과" 처럼 세부까지 치는 경우를 받는다.
const SUBTYPES = {
  '치과':        { cat: 'hospital', en: ['dental', 'dentist', 'teeth'], th: ['ทันตกรรม', 'หมอฟัน', 'ฟัน'], vi: ['nha khoa', 'nha sĩ', 'răng'] },
  '내과':        { cat: 'hospital', en: ['internal medicine', 'physician'], th: ['อายุรกรรม'], vi: ['nội khoa'] },
  '정형외과':     { cat: 'hospital', en: ['orthopedic', 'orthopaedic', 'bone'], th: ['กระดูก', 'ออร์โธปิดิกส์'], vi: ['chỉnh hình', 'xương khớp'] },
  '피부과':       { cat: 'hospital', en: ['dermatology', 'skin'], th: ['ผิวหนัง'], vi: ['da liễu'] },
  '이비인후과':    { cat: 'hospital', en: ['ent', 'ear nose throat', 'otolaryngology'], th: ['หูคอจมูก'], vi: ['tai mũi họng'] },
  '소아청소년과':  { cat: 'hospital', en: ['pediatric', 'paediatric', 'children'], th: ['กุมารเวช', 'เด็ก'], vi: ['nhi khoa', 'trẻ em'] },
  '안과':        { cat: 'hospital', en: ['ophthalmology', 'eye'], th: ['จักษุ', 'ตา'], vi: ['nhãn khoa', 'mắt'] },
  '산부인과':     { cat: 'hospital', en: ['obstetrics', 'gynecology', 'obgyn', 'maternity'], th: ['สูตินรีเวช', 'คลอด'], vi: ['sản phụ khoa'] },
  '정신건강의학과': { cat: 'hospital', en: ['psychiatry', 'mental health'], th: ['จิตเวช'], vi: ['tâm thần', 'sức khỏe tâm thần'] },
  '가정의학과':    { cat: 'hospital', en: ['family medicine'], th: ['เวชศาสตร์ครอบครัว'], vi: ['y học gia đình'] },
  '비뇨기과':     { cat: 'hospital', en: ['urology'], th: ['ทางเดินปัสสาวะ'], vi: ['tiết niệu'] },
  '외과':        { cat: 'hospital', en: ['surgery', 'surgical'], th: ['ศัลยกรรม'], vi: ['ngoại khoa'] },
  '성형외과':     { cat: 'hospital', en: ['plastic surgery', 'cosmetic surgery'], th: ['ศัลยกรรมตกแต่ง'], vi: ['phẫu thuật thẩm mỹ'] },
  '재활의학과':    { cat: 'hospital', en: ['rehabilitation', 'rehab'], th: ['เวชศาสตร์ฟื้นฟู'], vi: ['phục hồi chức năng'] },
  '신경외과':     { cat: 'hospital', en: ['neurosurgery'], th: ['ประสาทศัลยกรรม'], vi: ['ngoại thần kinh'] },
  '한의원':       { cat: 'hospital', en: ['oriental medicine', 'korean medicine', 'acupuncture'], th: ['แพทย์แผนเกาหลี', 'ฝังเข็ม'], vi: ['đông y', 'châm cứu'] },
  '한방병원':     { cat: 'hospital', en: ['oriental medicine hospital'], th: ['โรงพยาบาลแพทย์แผนเกาหลี'], vi: ['bệnh viện đông y'] },
  '동물병원':     { cat: 'hospital', en: ['animal hospital', 'vet', 'veterinary'], th: ['โรงพยาบาลสัตว์', 'สัตวแพทย์'], vi: ['thú y'] },
  '종합병원':     { cat: 'hospital', en: ['general hospital'], th: ['โรงพยาบาลทั่วไป'], vi: ['bệnh viện đa khoa'] },
  '노인,요양병원': { cat: 'hospital', en: ['nursing hospital', 'geriatric'], th: ['โรงพยาบาลผู้สูงอายุ'], vi: ['bệnh viện dưỡng lão'] },
  'ATM':        { cat: 'finance', en: ['atm', 'cash machine'], th: ['เอทีเอ็ม', 'ตู้เอทีเอ็ม'], vi: ['atm', 'máy rút tiền'] },
  '새마을금고':    { cat: 'finance', en: ['saemaul geumgo', 'credit union'], th: ['สหกรณ์'], vi: ['quỹ tín dụng'] },
  '네일샵':       { cat: 'beauty', en: ['nail', 'nail salon', 'manicure'], th: ['ทำเล็บ', 'ร้านทำเล็บ'], vi: ['làm móng', 'tiệm nail'] },
  '이발소':       { cat: 'beauty', en: ['barber', 'barbershop'], th: ['ร้านตัดผมชาย'], vi: ['tiệm hớt tóc'] },
  '동행정복지센터': { cat: 'government', en: ['community service center', 'dong office'], th: ['สำนักงานเขต'], vi: ['ủy ban phường'] },
  '하나로마트':    { cat: 'restaurant', en: ['hanaro mart'], th: ['ฮานาโรมาร์ท'], vi: ['hanaro mart'] },
  '대형마트':     { cat: 'restaurant', en: ['hypermarket', 'big mart'], th: ['ห้างใหญ่'], vi: ['đại siêu thị'] },
  '휴대폰판매':    { cat: 'mobile', en: ['phone shop', 'mobile shop'], th: ['ร้านมือถือ'], vi: ['cửa hàng điện thoại'] },
};

// ── 사람들이 실제로 부르는 지역 이름.
//
// "부산 광안리 미용실" 로 찾는 사람이 있는데 광안리는 행정 구역이 아니라
// 주소에도 안 들어간다. 이런 별칭을 구에 이어 준다.
//
// hint 가 있으면 그 구 안에서 주소에 그 말이 든 것만 고른다.
// hint 가 없으면 구까지만 좁힌다 — 주소에 그 말이 안 나오는 별칭이다.
//
// 2026-09-02 주소 실측으로 확인한 것에 [실측] 을 달았다. 나머지는 위치가
// 분명한 곳이다 (홍대=홍익대 마포구 상수동, 건대=건국대 광진구 화양동 등).
const ALIASES = [
  // 부산
  ['광안리',   'busan', 'suyeong-gu',      '광안'],    // [실측] 수영구 103건, 다른 구 0
  ['광안',     'busan', 'suyeong-gu',      '광안'],    // [실측]
  ['센텀시티', 'busan', 'haeundae-gu',     '센텀'],    // [실측] 해운대구 190건, 다른 구 0
  ['센텀',     'busan', 'haeundae-gu',     '센텀'],    // [실측]
  ['서면',     'busan', 'busanjin-gu',     null],      // 부산 서면은 부산진구. 서면은 다른 시도에도 흔해 hint 를 안 건다
  ['남포동',   'busan', 'jung-gu',         '남포'],    // [실측] 중구 19건
  ['자갈치',   'busan', 'jung-gu',         '자갈치'],  // [실측] 중구 16건
  ['태종대',   'busan', 'yeongdo-gu',      null],
  // 서울
  ['홍대',     'seoul', 'mapo-gu',         null],      // 홍익대 서울캠퍼스 = 마포구
  ['강남역',   'seoul', 'gangnam-gu',      null],
  ['압구정',   'seoul', 'gangnam-gu',      '압구정'],  // [실측] 강남구 338건, 다른 구 0
  ['가로수길', 'seoul', 'gangnam-gu',      '가로수길'],// [실측] 강남구 15건, 다른 구 0
  ['이태원',   'seoul', 'yongsan-gu',      '이태원'],  // [실측] 용산구 74건, 다른 구 0
  ['명동',     'seoul', 'jung-gu',         '명동'],    // [실측] 중구 138건 (다음이 9건)
  ['신촌',     'seoul', 'seodaemun-gu',    null],      // 서대문구 169 / 마포구 161 로 갈린다. 구까지만
  ['건대',     'seoul', 'gwangjin-gu',     null],      // 건국대 서울캠퍼스 = 광진구
  ['잠실',     'seoul', 'songpa-gu',       null],
  ['여의도',   'seoul', 'yeongdeungpo-gu', null],
  ['성수',     'seoul', 'seongdong-gu',    '성수'],    // [실측] 성동구 96건
  // 인천
  ['송도',     'incheon', 'yeonsu-gu',     '송도'],    // [실측] 연수구 165건
  ['차이나타운','incheon','jemulpo-gu',     null],      // [실측] 제물포구 6건
  // 대구
  ['동성로',   'daegu', 'jung-gu',         '동성로'],  // [실측] 대구 중구 132건
  // 경기
  ['판교',     'gyeonggi', 'seongnam-si',  '판교'],    // [실측] 성남시 351건
  ['일산',     'gyeonggi', 'goyang-si',    '일산'],    // [실측] 고양시 2,633건
];

// ── 데이터에서 구/군과 동을 뽑는다
const slugmap = JSON.parse(fs.readFileSync(path.join(ROOT, '_slugmap.json'), 'utf8'));
const regionIdx = {};
REGIONS.forEach((r, i) => { regionIdx[r[0]] = i; });
// 시도를 부르는 모든 한국어 말. 주소에서 구를 뽑을 때 이것들을 걸러낸다.
const regionWords = new Set();
REGIONS.forEach(r => regionWords.add(r[1]));
Object.values(REGION_ALIAS).forEach(list => list.forEach(w => {
  if (/^[가-힣]+$/.test(w)) regionWords.add(w);
}));

// 구/군 — _slugmap.json 이 한국어 이름과 슬러그를 이미 짝지어 두었다
const districts = [];
const distIdx = {};                                  // "region/slug" → 배열 위치
const knownDistrictNames = new Set();                // 폴더로 존재하는 구 이름
for (const [region, map] of Object.entries(slugmap)) {
  if (!(region in regionIdx)) continue;
  for (const [ko, slug] of Object.entries(map)) {
    if (slug === 'unknown') continue;
    distIdx[region + '/' + slug] = districts.length;
    districts.push([regionIdx[region], ko, slug, rr(ko)]);
    knownDistrictNames.add(ko);
  }
}

// 주소 안의 지역 낱말을 뽑는다. 어느 구에 있는지도 같이 기록한다.
//
// 무엇을 넣을지는 실측으로 정했다 (2026-09-02, 231,509건).
//   일반구  54,926건 24%   분당구·서북구·기흥구처럼 슬러그맵에 없는 구.
//                         사람들이 실제로 쓰는 말인데 폴더 구조에는 없다
//   읍·면   33,616건 15%   시골은 도로명에도 읍·면이 들어간다
//   동       1,749건  1%   주소가 대부분 도로명이라 동은 거의 없다
//   리·가      710건  0%
//
// 처음에는 동을 중심으로 설계했는데 데이터가 그렇지 않았다.
// 1% 짜리를 위해 사전을 60KB 불리는 것은 값이 안 맞는다. 있는 것만 넣는다.
const dongMap = new Map();                           // 한글 이름 → Set(구 위치)
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!e.name.endsWith('.json') || e.name.startsWith('_') || e.name === 'map_index.json') continue;
    const parts = p.split(path.sep);
    const i = parts.indexOf('split');
    const key = parts[i + 1] + '/' + parts[i + 2];
    const di = distIdx[key];
    if (di === undefined) continue;
    let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (x) { continue; }
    for (const pl of (j.places || [])) {
      const addr = String(pl.address || '');
      // 일반구를 먼저. 슬러그맵에 있는 구는 이미 d 에 들어가 있으니 뺀다.
      for (const g of (addr.match(/([가-힣]+구)(?=\s)/g) || [])) {
        if (knownDistrictNames.has(g)) continue;
        // "대구 달서구 …" 의 "대구" 는 시도다. 구로 오인하면 안 된다.
        if (regionWords.has(g)) continue;
        if (!dongMap.has(g)) dongMap.set(g, new Set());
        dongMap.get(g).add(di);
      }
      // 읍·면·동·리·가
      for (const name of (addr.match(/([가-힣]+[0-9]*(?:읍|면|동|리|가))(?=\s)/g) || [])) {
        if (!dongMap.has(name)) dongMap.set(name, new Set());
        dongMap.get(name).add(di);
      }
    }
  }
}
walk(ROOT);

const dongs = [...dongMap.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([ko, set]) => [ko, rr(ko), [...set].sort((a, b) => a - b)]);

// 별칭을 실제 구에 이어 붙인다. 구가 없으면 버린다 — 짐작으로 남겨 두지 않는다.
const aliases = [];
const aliasDropped = [];
for (const [name, region, slug, hint] of ALIASES) {
  const di = distIdx[region + '/' + slug];
  if (di === undefined) { aliasDropped.push(name + ' (' + region + '/' + slug + ')'); continue; }
  aliases.push([name, di, hint || null]);
}

// v 는 판번호이자 캐시 깨는 열쇠다.
//
// place_search.js 는 4시간(max-age=14400) 캐시된다. 그대로 두면 사전이나
// 검색 코드를 고쳐도 다시 온 사람은 옛 파일을 계속 쓴다. 실제로 그렇게 됐다.
// 화면이 스크립트를 부를 때 ?v=<이 값> 을 붙이므로, 사전을 다시 만들면
// 주소가 달라져 새로 받는다.
//
// ★ place_search.js 를 고쳤으면 이 스크립트를 다시 돌려라. 안 그러면 안 퍼진다.
const stamp = (function () {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes());
})();

const dict = {
  v: stamp,
  note: '장소 검색용 낱말 사전. build_search_dict.js 가 만든다.',
  r: REGIONS.map(([slug, ko, en, th, vi]) => [slug, ko, en, th, vi, REGION_ALIAS[slug] || []]),
  d: districts,
  n: dongs,
  a: aliases,
  c: CATEGORIES,
  s: SUBTYPES,
};

fs.writeFileSync(OUT, JSON.stringify(dict), 'utf8');
const kb = Math.round(fs.statSync(OUT).size / 1024);

console.log('사전을 만들었다 → data/search_dict.json  ' + kb + 'KB');
console.log('  시도      ' + dict.r.length);
console.log('  구/군     ' + dict.d.length);
console.log('  주소 낱말   ' + dict.n.length);
console.log('  지역 별칭  ' + dict.a.length + (aliasDropped.length ? '  (버림: ' + aliasDropped.join(', ') + ')' : ''));
console.log('  업태      ' + Object.keys(dict.c).length);
console.log('  세부 업태  ' + Object.keys(dict.s).length);
console.log('');
console.log('로마자 표기 표본 (고시 제2024-27호 제5항)');
['종로구', '상인동', '달서구', '신림동', '기장군', '천안시', '직산읍', '을지로2가']
  .forEach(k => console.log('    ' + k.padEnd(10) + rr(k)));
