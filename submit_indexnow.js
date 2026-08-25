/**
 * IndexNow 제출 스크립트
 *
 * 참여 검색엔진: Bing · Naver · Yandex · Seznam · Yep
 * 구글은 IndexNow 를 지원하지 않는다. 구글 색인은 sitemap 과 서치콘솔로만 처리된다.
 *
 * 사용법
 *   node submit_indexnow.js            변경된 URL만 제출 (권장, 배포 후 실행)
 *   node submit_indexnow.js --all      sitemap 전체 제출 (최초 1회)
 *   node submit_indexnow.js <url> ...  지정한 URL만 제출
 *   node submit_indexnow.js --dry      실제 전송 없이 대상만 출력
 *
 * 주의
 *   news/ 는 noindex 설계이므로 항상 제외한다.
 *   키 파일이 라이브에 올라가 있어야 제출이 수락된다.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = '082e4966f5873da7681bfde5b7b3b278';
const HOST = 'www.koricare.kr';
const KEY_LOCATION = `https://${HOST}/link/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10000;

const BASE_DIR = __dirname;
const SITEMAP_PATH = path.join(BASE_DIR, 'sitemap.xml');
const STATE_PATH = path.join(BASE_DIR, 'data', 'indexnow_state.json');

// sitemap.xml 에서 URL 추출 (news/ 제외)
function readSitemapUrls() {
  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const u = m[1].trim();
    if (u.includes('/news/')) continue;
    if (!u.startsWith(`https://${HOST}/link/`)) continue; // 키 경로 밖은 제출 불가
    urls.push(u);
  }
  return urls;
}

// 직전 제출 상태
function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (e) {
    return { lastSubmit: null, urls: {} };
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

// 파일 변경 시각으로 갱신 여부 판단
function localMtime(url) {
  const rel = url.replace(`https://${HOST}/link/`, '');
  const candidates = [
    path.join(BASE_DIR, rel, 'index.html'),
    path.join(BASE_DIR, rel),
    path.join(BASE_DIR, rel + '.html'),
    path.join(BASE_DIR, rel.replace(/\/$/, '') + '.html')
  ];
  for (const p of candidates) {
    try {
      const st = fs.statSync(p);
      if (st.isFile()) return Math.floor(st.mtimeMs);
    } catch (e) { /* 다음 후보 */ }
  }
  return null;
}

function post(urlList) {
  const body = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList
  });
  return new Promise((resolve) => {
    const req = https.request(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 300) }));
    });
    req.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
    req.write(body);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const all = args.includes('--all');
  const explicit = args.filter((a) => a.startsWith('http'));

  const state = readState();
  let targets;

  if (explicit.length) {
    targets = explicit;
    console.log(`대상: 직접 지정 ${targets.length}건`);
  } else {
    const urls = readSitemapUrls();
    if (all) {
      targets = urls;
      console.log(`대상: sitemap 전체 ${targets.length}건`);
    } else {
      targets = urls.filter((u) => {
        const mt = localMtime(u);
        if (mt === null) return false;
        return !state.urls[u] || state.urls[u] < mt;
      });
      console.log(`대상: 변경분 ${targets.length}건 (sitemap ${urls.length}건 중)`);
    }
  }

  if (!targets.length) {
    console.log('제출할 URL이 없습니다.');
    return;
  }
  if (targets.length > MAX_URLS) {
    console.log(`요청당 상한 ${MAX_URLS}건을 초과합니다. 나눠서 실행하십시오.`);
    return;
  }

  targets.slice(0, 5).forEach((u) => console.log('  ' + u));
  if (targets.length > 5) console.log(`  ... 외 ${targets.length - 5}건`);

  if (dry) {
    console.log('\n--dry 모드입니다. 전송하지 않았습니다.');
    return;
  }

  const res = await post(targets);
  console.log(`\n응답 ${res.status} ${res.body}`);

  // 200 수락 / 202 키 검증 대기
  if (res.status === 200 || res.status === 202) {
    const now = Math.floor(Date.now());
    targets.forEach((u) => { state.urls[u] = localMtime(u) || now; });
    state.lastSubmit = new Date().toISOString();
    writeState(state);
    console.log(`제출 완료. 상태 파일 갱신: ${path.relative(BASE_DIR, STATE_PATH)}`);
  } else {
    console.log('제출이 수락되지 않았습니다. 상태 파일을 갱신하지 않습니다.');
  }
}

main();
