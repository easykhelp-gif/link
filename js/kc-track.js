// 코리케어 측정 — 문의 클릭 · 가이드 끝까지 읽음
// 화면에는 아무것도 그리지 않는다. gtag 가 없으면 조용히 넘어간다.
(function () {
  function send(name, params) {
    if (typeof gtag === 'function') gtag('event', name, params || {});
  }

  // 문의 클릭: 메신저·라인·메일로 가는 링크.
  // 계산기처럼 onclick 으로 이미 contact_click 을 보내는 링크는 건너뛴다 (이중 집계 방지).
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if ((a.getAttribute('onclick') || '').indexOf('contact_click') !== -1) return;
    var h = a.getAttribute('href') || '';
    var method = /(^|\/\/)m\.me\//.test(h) ? 'messenger'
      : /line\.me\//.test(h) ? 'line'
      : /^mailto:/i.test(h) ? 'email'
      : '';
    if (method) send('contact_click', { method: method, source: location.pathname });
  }, true);

  // 가이드 끝까지 읽음: 본문(article) 끝이 화면 아래 끝보다 위로 올라오면 한 번만 보낸다.
  // 빠르게 튕겨 내려 끝을 건너뛰어도 잡히도록 교차 여부가 아니라 위치로 판정한다.
  var art = document.querySelector('main article');
  if (art && /\/guides\/.+\//.test(location.pathname)) {
    var done = false, ticking = false;
    var check = function () {
      ticking = false;
      if (done) return;
      if (art.getBoundingClientRect().bottom <= window.innerHeight) {
        done = true;
        window.removeEventListener('scroll', onScroll);
        send('guide_read_complete', { page: location.pathname });
      }
    };
    var onScroll = function () {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
