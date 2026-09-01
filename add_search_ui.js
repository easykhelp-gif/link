// Local Directory 에 검색창을 붙인다. 네 언어 포털에 같은 것을 넣는다.
//
// 설계
//   검색은 기존 화면을 대체하지 않는다. 시도·구·업태 드롭다운을 대신 채워 주고,
//   그리기는 지금 쓰는 코드가 그대로 한다. 그래서 페이지 넘기기도 저절로 따라온다.
//   검색어에 읍·면이나 세부 업태가 들어 있으면 그것만 추가 필터로 건다.
//
//   사전(102KB)은 검색창을 처음 건드릴 때 받는다. 안 쓰는 사람은 안 받는다.
//
//   node add_search_ui.js --dry
//   node add_search_ui.js

const fs = require('fs');
const path = require('path');

const REPO = 'C:/Users/y1611/Desktop/agent/temp_link_repo3';
const dry = process.argv.includes('--dry');

const FILES = ['index.html', 'th/index.html', 'vi/index.html'];

// 언어별 문구
const L = {
  'index.html':    { ph: 'Search  e.g. Bundang-gu dental',
                     clear: 'Clear', noHit: 'Try an area and a type — e.g. Bundang-gu dental' },
  'th/index.html': { ph: 'ค้นหา  เช่น Bundang-gu ทันตกรรม',
                     clear: 'ล้าง', noHit: 'ลองใส่พื้นที่และประเภท เช่น Bundang-gu ทันตกรรม' },
  'vi/index.html': { ph: 'Tìm  ví dụ Bundang-gu nha khoa',
                     clear: 'Xóa', noHit: 'Thử khu vực và loại — ví dụ Bundang-gu nha khoa' },
};

const ANCHOR = '<div class="local-filter-group" id="groupRegions"';

function block(t) {
  // 아래 드롭다운과 같은 옷을 입힌다. 테두리·모서리·그림자·글자 굵기를 그대로 맞춰야
  // 따로 붙인 물건이 아니라 같은 줄의 컨트롤로 읽힌다.
  // 돋보기는 이모지가 아니라 선으로 그린다. 이모지는 기기마다 모양이 달라지고
  // 글자 크기에 안 맞는다.
  return `    <!-- 장소 검색. 사전은 처음 누를 때 받는다 (102KB) -->
    <div class="local-search-wrap" style="margin-top:16px; position:relative; width:100%;">
      <input id="placeSearch" type="search" autocomplete="off" enterkeyhint="search"
             placeholder="${t.ph}"
             style="width:100%; font-size:14.5px; font-weight:700; padding:12px 42px 12px 42px; border-radius:14px; border:1.5px solid var(--line); background:#ffffff; color:var(--navy); outline:none; box-shadow:0 2px 8px rgba(0,0,0,0.03); box-sizing:border-box; -webkit-appearance:none; appearance:none;">
      <svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17"
           style="position:absolute; left:15px; top:50%; transform:translateY(-50%); pointer-events:none; color:#94a3b8;"
           fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
        <circle cx="8.6" cy="8.6" r="5.6"></circle><path d="M12.8 12.8L17 17"></path>
      </svg>
      <button id="placeSearchClear" type="button" aria-label="${t.clear}"
              style="display:none; position:absolute; right:12px; top:50%; transform:translateY(-50%); border:none; background:none; color:#94a3b8; width:22px; height:22px; padding:0; cursor:pointer; line-height:0;">
        <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
          <path d="M5 5l10 10M15 5L5 15"></path>
        </svg>
      </button>
    </div>
    <div id="placeSearchNote" style="display:none; font-size:12.5px; font-weight:600; color:#475569; margin:8px 2px 0; line-height:1.5;"></div>

`;
}

// 카드 필터 지점 — 읍·면과 세부 업태를 여기서 건다
const FILTER_FROM = 'var filteredPlaces = currentRegionPlaces;';
const FILTER_TO = 'var filteredPlaces = applySearchFilter(currentRegionPlaces);   // 검색으로 들어왔으면 읍·면·세부업태를 더 거른다';

function script(t) {
  return `
  // ── 장소 검색 ───────────────────────────────────────────────
  // 검색어를 시도·구·업태로 갈라 드롭다운을 대신 채운다.
  // 그리기는 기존 코드가 하므로 페이지 넘기기가 그대로 따라온다.
  var SEARCH_FILTER = null;   // { place: "정관읍", sub: "치과", free: [...] }
  var PLACE_DICT = null;
  var PLACE_SEARCH = null;

  function applySearchFilter(list) {
    if (!SEARCH_FILTER) return list;
    var f = SEARCH_FILTER;
    return list.filter(function (p) {
      if (f.place && String(p.address || '').indexOf(f.place) < 0) return false;
      if (f.sub && String(p.category_detail || '').indexOf(f.sub) < 0) return false;
      if (f.free && f.free.length) {
        var hay = [p.name_ko, p.name_en, p.name_th, p.name_vi, p.address, p.category_detail]
          .join(' ').toLowerCase().replace(/[\\s\\-_.·,]/g, '');
        for (var i = 0; i < f.free.length; i++) if (hay.indexOf(f.free[i]) < 0) return false;
      }
      return true;
    });
  }

  function loadSearchDict() {
    if (PLACE_DICT) return Promise.resolve(PLACE_DICT);
    // dataBase() 는 페이지 위치에 따라 "data/split/" · "link/data/split/" · "../data/split/"
    // 셋 중 하나다. 여기서 파생시키면 세 언어 모두 맞는다.
    var root = dataBase().replace(/data\\/split\\/$/, '');
    return Promise.all([
      fetch(root + 'data/search_dict.json').then(function (r) { return r.json(); }),
      (window.PlaceSearch ? Promise.resolve() : new Promise(function (ok, no) {
        var s = document.createElement('script');
        s.src = root + 'lib/place_search.js';
        s.onload = ok; s.onerror = no;
        document.head.appendChild(s);
      }))
    ]).then(function (r) {
      PLACE_DICT = r[0];
      PLACE_SEARCH = window.PlaceSearch.createSearch(PLACE_DICT, function () { return null; });
      return PLACE_DICT;
    });
  }

  function runPlaceSearch(query) {
    var note = document.getElementById('placeSearchNote');
    if (!query.trim()) { clearPlaceSearch(); return; }
    loadSearchDict().then(function () {
      var r = PLACE_SEARCH.resolve(query);
      if (!r.region && !r.need) { note.textContent = ${JSON.stringify(t.noHit)}; note.style.display = 'block'; return; }

      // 동·읍·면이 여러 구에 있어 못 정한 경우 — 시도만 세우고 구를 고르게 둔다
      if (r.need === 'district') {
        var first = r.options[0];
        r = { region: first.region[0], district: first.i,
              dongName: r.dongName, category: r.category, sub: r.sub, free: r.free };
      }

      SEARCH_FILTER = { place: r.dongName || null, sub: r.sub || null, free: r.free || [] };

      var dd = document.getElementById('regionDropdown');
      actRegion = r.region; if (dd) dd.value = r.region;
      selectedDistrict = (r.district !== null && r.district !== undefined)
        ? PLACE_DICT.d[r.district][2] : '';
      selectedCategory = r.category || '';
      currentPage = 1;

      // 무엇으로 알아들었는지 보여 준다. 업태 이름은 화면이 이미 쓰는 이름표를
      // 그대로 가져온다 — 여기서 따로 적으면 언어마다 두 벌이 된다.
      function showNote() {
        var bits = [];
        if (r.district !== null && r.district !== undefined) bits.push(PLACE_DICT.d[r.district][1]);
        if (r.dongName) bits.push(r.dongName);
        if (r.sub) bits.push(r.sub);
        else if (r.category) {
          // 화면에 select 가 여럿이다(지역·구·업태, 그리고 무관한 catsDropdown).
          // 위치로 집으면 엉뚱한 것을 잡는다. 그 값을 가진 옵션이 있는 것을 찾는다.
          var label = null;
          var sels = document.querySelectorAll('#localGrid select');
          for (var s = 0; s < sels.length && !label; s++) {
            for (var i = 0; i < sels[s].options.length; i++) {
              if (sels[s].options[i].value === r.category) {
                label = sels[s].options[i].textContent.trim();
                break;
              }
            }
          }
          bits.push(label || r.category);
        }
        note.textContent = bits.join(' · ');
        note.style.display = bits.length ? 'block' : 'none';
      }

      if (selectedDistrict && selectedCategory) {
        loadPlaces(actRegion, selectedDistrict, selectedCategory, function () {
          renderFilterControlsAndPlaces();
          showNote();
        });
      } else {
        currentRegionPlaces = [];
        renderFilterControlsAndPlaces();
        showNote();
      }
      var sec = document.querySelector('.local-directory-section');
      if (sec) sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }).catch(function () {
      note.textContent = ${JSON.stringify(t.noHit)};
      note.style.display = 'block';
    });
  }

  function clearPlaceSearch() {
    SEARCH_FILTER = null;
    var i = document.getElementById('placeSearch');
    if (i) i.value = '';
    var n = document.getElementById('placeSearchNote');
    if (n) { n.textContent = ''; n.style.display = 'none'; }
    var c = document.getElementById('placeSearchClear');
    if (c) c.style.display = 'none';
    renderFilterControlsAndPlaces();
  }

  (function () {
    var box = document.getElementById('placeSearch');
    if (!box) return;
    var clear = document.getElementById('placeSearchClear');
    box.addEventListener('focus', function () { loadSearchDict(); }, { once: true });
    box.addEventListener('input', function () {
      clear.style.display = box.value ? 'block' : 'none';
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); runPlaceSearch(box.value); }
    });
    clear.addEventListener('click', clearPlaceSearch);
  })();
`;
}

let changed = 0;
for (const rel of FILES) {
  const f = path.join(REPO, rel);
  let s = fs.readFileSync(f, 'utf8');
  const t = L[rel];
  const before = s;

  if (s.indexOf('id="placeSearch"') >= 0) { console.log('  이미 있음: ' + rel); continue; }
  if (s.indexOf(ANCHOR) < 0) { console.log('  ★ 자리 못 찾음: ' + rel); continue; }
  if (s.indexOf(FILTER_FROM) < 0) { console.log('  ★ 필터 지점 못 찾음: ' + rel); continue; }

  s = s.replace(ANCHOR, block(t) + ANCHOR);
  s = s.replace(FILTER_FROM, FILTER_TO);

  // 스크립트는 renderFilterControlsAndPlaces 정의 뒤에 넣는다
  const mark = 'function setDistrictFilter(dist) {';
  if (s.indexOf(mark) < 0) { console.log('  ★ 스크립트 자리 못 찾음: ' + rel); continue; }
  s = s.replace(mark, script(t) + '\n' + mark);

  if (s !== before) {
    changed++;
    console.log('  ' + rel + '  +' + (s.length - before.length) + '자');
    if (!dry) fs.writeFileSync(f, s, 'utf8');
  }
}
console.log('');
console.log((dry ? '[미리보기] ' : '') + changed + '개 파일');
