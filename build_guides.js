const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const GUIDES_LIST_PATH = path.join(DATA_DIR, 'guides_list.json');
const TEMPLATE_PATH = path.join(BASE_DIR, 'templates', 'guide_template.html');
const INDEX_PATH = path.join(BASE_DIR, 'index.html');
const GUIDES_SITEMAP_PATH = path.join(DATA_DIR, 'guides_sitemap.json');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function buildGuides() {
  if (!fs.existsSync(GUIDES_LIST_PATH)) {
    console.log('[Info] No guides_list.json found. Skipping guides build.');
    return;
  }
  
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error('[Error] templates/guide_template.html missing. Cannot build guides.');
    return;
  }

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  let guides = [];
  try {
    guides = JSON.parse(fs.readFileSync(GUIDES_LIST_PATH, 'utf-8'));
  } catch (e) {
    console.error('[Error] Invalid JSON in guides_list.json', e);
    return;
  }

  const sitemapUrls = [];
  const langs = ['en', 'th', 'vi'];
  const hubLinks = { en: [], th: [], vi: [] };

  guides.forEach(guide => {
    // Generate for each language
    langs.forEach(lang => {
      const guideDir = path.join(BASE_DIR, lang, 'guides', guide.category, guide.id);
      ensureDir(guideDir);
      
      let html = template;
      
      const canonicalEn = `https://www.koricare.kr/link/en/guides/${guide.category}/${guide.id}/`;
      const canonicalTh = `https://www.koricare.kr/link/th/guides/${guide.category}/${guide.id}/`;
      const canonicalVi = `https://www.koricare.kr/link/vi/guides/${guide.category}/${guide.id}/`;
      const currCanonical = lang === 'en' ? canonicalEn : (lang === 'th' ? canonicalTh : canonicalVi);
      
      html = html.replace(/\{\{LANG\}\}/g, lang);
      html = html.replace(/\{\{CANONICAL_URL\}\}/g, currCanonical);
      html = html.replace(/\{\{CANONICAL_URL_EN\}\}/g, canonicalEn);
      html = html.replace(/\{\{CANONICAL_URL_TH\}\}/g, canonicalTh);
      html = html.replace(/\{\{CANONICAL_URL_VI\}\}/g, canonicalVi);
      
      const currTitle = lang === 'en' ? guide.title_en : (lang === 'th' ? guide.title_th : guide.title_vi);
      html = html.replace(/\{\{TITLE\}\}/g, currTitle || guide.title_en || '');
      html = html.replace(/\{\{TITLE_EN\}\}/g, currTitle || guide.title_en || '');
      html = html.replace(/\{\{DATE\}\}/g, guide.date || '');
      
      const currContent = lang === 'en' ? guide.content_en : (lang === 'th' ? guide.content_th : guide.content_vi);
      let description = guide['description_' + lang];
      if (!description && currContent) {
        description = currContent.replace(/<[^>]*>?/gm, '').substring(0, 150).trim() + '...';
      }
      html = html.replace(/\{\{DESCRIPTION\}\}/g, description || '');
      
      let imgUrl = (guide.image && guide.image.startsWith('news/')) ? '/link/' + guide.image : (guide.image || '');
      if (imgUrl.startsWith('/link/')) {
        imgUrl = 'https://www.koricare.kr' + imgUrl;
      }
      html = html.replace(/\{\{IMAGE_URL\}\}/g, imgUrl);
      
      let catName = guide.tag ? guide.tag : (guide.category.charAt(0).toUpperCase() + guide.category.slice(1));
      html = html.replace(/\{\{CATEGORY_NAME\}\}/g, catName);
      
      let contentHtml = currContent || '';
      contentHtml = contentHtml.replace(/src="news\//g, 'src="/link/news/');
      contentHtml = contentHtml.replace(/href="news\//g, 'href="/link/news/');
      html = html.replace(/\{\{CONTENT\}\}/g, contentHtml);

      html = html.replace(/\{\{CATEGORY\}\}/g, guide.category);
      html = html.replace(/\{\{ID\}\}/g, guide.id);
      
      let currLangName = '';
      let otherLangLinks = '';
      
      if (lang === 'en') {
        currLangName = 'English';
        otherLangLinks = `
          <a href="/link/th/guides/${guide.category}/${guide.id}/" class="lang-option">ภาษาไทย</a>
          <a href="/link/vi/guides/${guide.category}/${guide.id}/" class="lang-option">Tiếng Việt</a>
        `;
      } else if (lang === 'th') {
        currLangName = 'ภาษาไทย';
        otherLangLinks = `
          <a href="/link/en/guides/${guide.category}/${guide.id}/" class="lang-option">English</a>
          <a href="/link/vi/guides/${guide.category}/${guide.id}/" class="lang-option">Tiếng Việt</a>
        `;
      } else if (lang === 'vi') {
        currLangName = 'Tiếng Việt';
        otherLangLinks = `
          <a href="/link/en/guides/${guide.category}/${guide.id}/" class="lang-option">English</a>
          <a href="/link/th/guides/${guide.category}/${guide.id}/" class="lang-option">ภาษาไทย</a>
        `;
      }
      
      html = html.replace(/\{\{CURRENT_LANG_NAME\}\}/g, currLangName);
      html = html.replace(/\{\{OTHER_LANG_LINKS\}\}/g, otherLangLinks);

      let homeUrl = `/link/${lang}/index.html`;
      if (lang === 'en') {
        homeUrl = '/link/index.html';
      }
      html = html.replace(/\{\{LANG_HOME_URL\}\}/g, homeUrl);

      const outputPath = path.join(guideDir, 'index.html');
      fs.writeFileSync(outputPath, html, 'utf-8');
      
      sitemapUrls.push({
        loc: currCanonical,
        changefreq: 'monthly',
        priority: 0.7
      });
      
      // Store link for hub page
      const title = lang === 'en' ? guide.title_en : (lang === 'th' ? guide.title_th : guide.title_vi) || guide.title_en;
      hubLinks[lang].push({
        url: currCanonical,
        title: title,
        date: guide.date,
        category: guide.category,
        id: guide.id,
        image: guide.image
      });
    });
  });

  // Generate Hub pages
  langs.forEach(lang => {
    const hubDir = path.join(BASE_DIR, lang, 'guides');
    ensureDir(hubDir);
    
    // Translations for categories and descriptions
    const t = {
      en: {
        title: "Kori Care Guides",
        back: "← Back to Home",
        korea_title: "Living in Korea",
        korea_desc: "Essential information for a smooth and safe life in South Korea. From navigating healthcare and insurance to understanding your legal labor rights as a foreign resident.",
        safety_title: "Safety & Money",
        safety_desc: "How to protect your money, your identity and yourself in Korea — scams, banking and what to do if something goes wrong.",
        travel_title: "Travel & Leisure",
        travel_desc: "Discover the best places to visit during your weekends and holidays. We provide budget-friendly itineraries, transportation tips, and hidden local gems.",
        desc_hospital: "A comprehensive guide to medical costs, ER usage, and pharmacy rules for foreigners with or without NHIS.",
        desc_severance: "Learn how to claim your EPS Departure Guarantee Insurance legally and safely before leaving Korea.",
        desc_incheon: "A perfect 1-day itinerary to see the ocean, ride the Wolmido Viking, and eat Jajangmyeon in Chinatown.",
        desc_seoul: "Explore Gyeongbokgung, Bukchon, and Cheonggyecheon on a budget with this free photo course.",
        desc_scam: "How voice phishing and identity theft work in Korea, the penalties, and how to protect your account and ARC."
      },
      th: {
        title: "คู่มือ Kori Care",
        back: "← กลับสู่หน้าหลัก",
        korea_title: "การใช้ชีวิตในเกาหลี",
        korea_desc: "ข้อมูลสำคัญเพื่อการใช้ชีวิตที่ราบรื่นและปลอดภัยในเกาหลีใต้ ตั้งแต่การใช้บริการด้านสุขภาพและประกัน ไปจนถึงการทำความเข้าใจสิทธิแรงงานตามกฎหมายของคุณในฐานะชาวต่างชาติ",
        safety_title: "ความปลอดภัยและการเงิน",
        safety_desc: "วิธีปกป้องเงิน ข้อมูลส่วนตัว และตัวคุณเองในเกาหลี ทั้งเรื่องมิจฉาชีพ ธนาคาร และสิ่งที่ต้องทำเมื่อเกิดปัญหา",
        travel_title: "การท่องเที่ยวและการพักผ่อน",
        travel_desc: "ค้นพบสถานที่ท่องเที่ยวที่ดีที่สุดในช่วงวันหยุดสุดสัปดาห์และวันหยุดยาว เรามีแผนการเดินทางที่ประหยัดงบ เคล็ดลับการเดินทาง และสถานที่ลับยอดฮิตของคนท้องถิ่น",
        desc_hospital: "คู่มือที่ครอบคลุมเกี่ยวกับค่ารักษาพยาบาล การใช้ห้องฉุกเฉิน และกฎของร้านขายยาสำหรับชาวต่างชาติที่มีและไม่มี NHIS",
        desc_severance: "เรียนรู้วิธีการขอรับเงินประกันการเดินทางกลับ EPS อย่างถูกต้องตามกฎหมายและปลอดภัยก่อนเดินทางออกจากเกาหลี",
        desc_incheon: "แผนการเดินทาง 1 วันที่สมบูรณ์แบบเพื่อไปดูทะเล เล่นเครื่องเล่นไวกิ้งที่วอลมิโด และกินจาจังมยอนในไชน่าทาวน์",
        desc_seoul: "สำรวจคยองบกกุง บุกชอน และชองกเยชอนแบบประหยัดงบด้วยคอร์สถ่ายรูปฟรีนี้"
      },
      vi: {
        title: "Hướng dẫn Kori Care",
        back: "← Quay lại Trang chủ",
        korea_title: "Cuộc sống tại Hàn Quốc",
        korea_desc: "Thông tin thiết yếu để có một cuộc sống suôn sẻ và an toàn tại Hàn Quốc. Từ việc điều hướng chăm sóc sức khỏe và bảo hiểm đến việc hiểu quyền lợi lao động hợp pháp của bạn với tư cách là người cư trú nước ngoài.",
        safety_title: "An toàn & Tài chính",
        safety_desc: "Cách bảo vệ tiền bạc, danh tính và bản thân bạn tại Hàn Quốc — lừa đảo, ngân hàng và những việc cần làm khi có sự cố.",
        travel_title: "Du lịch & Giải trí",
        travel_desc: "Khám phá những địa điểm tham quan tốt nhất trong những ngày cuối tuần và ngày lễ. Chúng tôi cung cấp các lịch trình tiết kiệm, mẹo di chuyển và những viên ngọc ẩn giấu của địa phương.",
        desc_hospital: "Hướng dẫn toàn diện về chi phí y tế, sử dụng phòng cấp cứu và các quy định tại hiệu thuốc cho người nước ngoài có hoặc không có NHIS.",
        desc_severance: "Tìm hiểu cách yêu cầu Bảo hiểm Bảo lãnh Xuất cảnh EPS của bạn một cách hợp pháp và an toàn trước khi rời khỏi Hàn Quốc.",
        desc_incheon: "Lịch trình 1 ngày hoàn hảo để ngắm biển, đi tàu Viking Wolmido và ăn Jajangmyeon ở Phố Tàu.",
        desc_seoul: "Khám phá Gyeongbokgung, Bukchon và Cheonggyecheon với ngân sách tiết kiệm cùng khóa học chụp ảnh miễn phí này."
      }
    };
    const texts = t[lang];

    const koreaGuides = hubLinks[lang].filter(l => l.category === 'korea').sort((a,b) => new Date(b.date) - new Date(a.date));
    const travelGuides = hubLinks[lang].filter(l => l.category === 'travel').sort((a,b) => new Date(b.date) - new Date(a.date));
    const safetyGuides = hubLinks[lang].filter(l => l.category === 'safety').sort((a,b) => new Date(b.date) - new Date(a.date));
    
    let position = 1;
    const itemListElements = [];

    const buildGuideList = (guides) => {
      return guides.map(l => {
        const descKey = l.id.indexOf('scam') === 0 || l.id.indexOf('scam') > -1 ? 'scam' : l.id.replace('guide_', '').replace('travel_', '').split('_')[0];
        let desc = texts['desc_' + descKey];
        if (!desc) desc = "";
        
        itemListElements.push(`{
          "@type": "ListItem",
          "position": ${position++},
          "item": {
            "@type": "Article",
            "url": "${l.url}",
            "name": "${l.title}"
          }
        }`);

        const thumb = l.image ? `https://www.koricare.kr/link/${l.image}` : '';
        return `
        <div class="guide-card">
          ${thumb ? `<a href="${l.url}" class="guide-thumb"><img src="${thumb}" alt="" loading="lazy"></a>` : ''}
          <div class="guide-body">
            <a href="${l.url}" class="guide-title">${l.title}</a>
            <p class="guide-desc">${desc}</p>
            <span class="guide-date">${l.date}</span>
          </div>
        </div>`;
      }).join('');
    };

    const koreaGuidesHtml = buildGuideList(koreaGuides);
    const travelGuidesHtml = buildGuideList(travelGuides);
    const safetyGuidesHtml = buildGuideList(safetyGuides);

    const hubHtml = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${texts.title}</title>
<link rel="canonical" href="https://www.koricare.kr/link/${lang}/guides/">
<meta name="description" content="${texts.korea_desc} ${texts.travel_desc}">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-F0R2ZQNNPZ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-F0R2ZQNNPZ');
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    ${itemListElements.join(',\n    ')}
  ]
}
</script>
<style>
  body { font-family: "Inter", system-ui, sans-serif; background: #f8fafc; color: #0f172a; padding: 20px; line-height: 1.6; margin: 0; }
  .container { max-width: 800px; margin: 0 auto; }
  .header-card { background: #002366; color: #ffffff; padding: 40px 30px; border-radius: 16px; margin-bottom: 30px; box-shadow: 0 10px 25px rgba(0,35,102,0.15); }
  .header-card h1 { margin: 0 0 10px 0; font-size: 28px; font-weight: 800; }
  .header-card p { margin: 0; color: #e0e7ff; font-size: 16px; }
  .back-link { display: inline-block; color: #64748b; text-decoration: none; font-weight: 600; margin-bottom: 20px; transition: color 0.2s; }
  .back-link:hover { color: #0f172a; }
  .section-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 40px 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
  .section-desc { font-size: 15px; color: #475569; margin-bottom: 24px; }
</style>
<style>
  .guide-card{display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:14px;box-shadow:0 2px 4px rgba(0,0,0,0.02)}
  .guide-thumb{flex:none;width:96px;height:72px;border-radius:8px;overflow:hidden;display:block;background:#f1f5f9}
  .guide-thumb img{width:100%;height:100%;object-fit:cover;display:block}
  .guide-body{min-width:0;flex:1}
  .guide-title{color:#1e40af;text-decoration:none;font-size:17px;font-weight:700;display:block;margin-bottom:6px;line-height:1.35}
  .guide-desc{color:#475569;font-size:14px;margin:0 0 8px 0;line-height:1.55}
  .guide-date{color:#94a3b8;font-size:12.5px;font-weight:500}
  @media (max-width:480px){
    .guide-thumb{width:76px;height:60px}
    .guide-title{font-size:15.5px}
    .guide-desc{font-size:13.5px}
  }
</style>
</head>
<body>
<div class="container">
  <a href="/link/${lang === 'en' ? 'index.html' : lang + '/index.html'}" class="back-link">${texts.back}</a>
  
  <div class="header-card">
    <h1>${texts.title}</h1>
    <p>Comprehensive guides for your journey in Korea.</p>
  </div>

  <h2 class="section-title">${texts.korea_title}</h2>
  <p class="section-desc">${texts.korea_desc}</p>
  ${koreaGuidesHtml}

  <h2 class="section-title">${texts.safety_title}</h2>
  <p class="section-desc">${texts.safety_desc}</p>
  ${safetyGuidesHtml}
  <h2 class="section-title">${texts.travel_title}</h2>
  <p class="section-desc">${texts.travel_desc}</p>
  ${travelGuidesHtml}

</div>
</body>
</html>`;
    fs.writeFileSync(path.join(hubDir, 'index.html'), hubHtml, 'utf-8');
    
    sitemapUrls.push({
      loc: `https://www.koricare.kr/link/${lang}/guides/`,
      changefreq: 'weekly',
      priority: 0.8
    });
  });

  fs.writeFileSync(GUIDES_SITEMAP_PATH, JSON.stringify(sitemapUrls, null, 2), 'utf-8');
  console.log('[Success] Generated data/guides_sitemap.json');

  mergeSitemap(sitemapUrls);
  updateIndexHtml(guides);
}

function mergeSitemap(sitemapUrls) {
  const SITEMAP_PATH = path.join(BASE_DIR, 'sitemap.xml');
  if (!fs.existsSync(SITEMAP_PATH)) return;
  let content = fs.readFileSync(SITEMAP_PATH, 'utf-8');
  
  // Remove all existing guide URLs from sitemap
  content = content.replace(/<url>\s*<loc>[^<]*\/guides\/[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  
  // Remove any double blank lines left behind
  content = content.replace(/^\s*[\r\n]/gm, '');
  if (!content.endsWith('\n')) content += '\n';
  
  // Create XML for new URLs
  const newXml = sitemapUrls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n');
  
  // Insert before </urlset>
  content = content.replace('</urlset>', newXml + '\n</urlset>');
  
  fs.writeFileSync(SITEMAP_PATH, content, 'utf-8');
  console.log('[Success] Merged guides into sitemap.xml');
}

function updateIndexHtml(guides) {
  if (!fs.existsSync(INDEX_PATH)) return;
  
  let content = fs.readFileSync(INDEX_PATH, 'utf-8');
  const startM = '<!-- GUIDE_START -->';
  const endM = '<!-- GUIDE_END -->';
  const sIdx = content.indexOf(startM);
  const eIdx = content.indexOf(endM);

  if (sIdx !== -1 && eIdx !== -1) {
    const sortedGuides = guides.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const top3 = sortedGuides.slice(0, 3);
    const cardsHtml = top3.map(item => {
      let thumb = item.image || 'https://www.koricare.kr/link/koricare_main_logo_nobg.png';
      if (thumb.startsWith('news/')) thumb = '/link/' + thumb;
      const title = item.title_en || item.title_ko || item.title_th || item.title_vi;
      let badgeHtml = item.tag ? `<div style="font-size:11px; font-weight:800; color:#2563eb; background:#eff6ff; padding:2px 6px; border-radius:4px; margin-bottom:4px; display:inline-block;">${item.tag}</div>` : '';
      const dateStr = item.date || '';
      
      return `    <a href="en/guides/${item.category}/${item.id}/" class="list-item-card" style="display:flex; flex-direction:row; padding:14px 0; border-bottom:1px solid var(--line); text-decoration:none; transition:all 0.2s ease; align-items:center;">
      <div class="list-thumb" style="width:96px; height:72px; flex-shrink:0; border-radius:12px; background:#f1f5f9; overflow:hidden; margin-right:14px;">
        <img src="${thumb}" alt="${title}" onerror="this.onerror=null;this.src='https://www.koricare.kr/link/koricare_main_logo_nobg.png';" style="width:100%; height:100%; object-fit:cover; display:block;">
      </div>
      <div style="display:flex; flex-direction:column; flex:1; justify-content:center;">
        <div>${badgeHtml}</div>
        <div class="list-title" style="font-size:16px; font-weight:700; color:var(--ink); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word;">${title}</div>
        <div style="font-size:13px; color:var(--sub); margin-top:6px; font-weight:500;">Kori Care Guide &middot; ${dateStr}</div>
      </div>
    </a>`;
    }).join('\n');

    const updated = content.slice(0, sIdx + startM.length) + 
      '\n  <div class="news-list" id="guide-list" style="display:flex; flex-direction:column; margin-bottom:28px;">\n' + 
      cardsHtml + 
      '\n    <a href="en/guides/index.html" style="display:flex; justify-content:center; align-items:center; gap:8px; padding:14px; background:#ffffff; color:#1e40af; border:1.5px solid #bfdbfe; border-radius:14px; font-weight:800; font-size:15px; text-decoration:none; margin-top:16px; transition:all 0.2s ease; box-shadow:0 2px 6px rgba(37,99,235,0.06);" onmouseover="this.style.background=\'#eff6ff\'; this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 4px 12px rgba(37,99,235,0.12)\';" onmouseout="this.style.background=\'#ffffff\'; this.style.transform=\'translateY(0)\'; this.style.boxShadow=\'0 2px 6px rgba(37,99,235,0.06)\';">View All Guides ➔</a>\n  </div>\n  ' + content.slice(eIdx);
    
    fs.writeFileSync(INDEX_PATH, updated, 'utf-8');
    
    // Also update th/index.html and vi/index.html
    ['th', 'vi'].forEach(lang => {
      const p = path.join(BASE_DIR, lang, 'index.html');
      if (fs.existsSync(p)) {
        let c = fs.readFileSync(p, 'utf-8');
        let langCards = top3.map(item => {
          let thumb = item.image || 'https://www.koricare.kr/link/koricare_main_logo_nobg.png';
          if (thumb.startsWith('news/')) thumb = '/link/' + thumb;
          const title = (lang === 'th' ? item.title_th : item.title_vi) || item.title_en;
          let badgeHtml = item.tag ? `<div style="font-size:11px; font-weight:800; color:#2563eb; background:#eff6ff; padding:2px 6px; border-radius:4px; margin-bottom:4px; display:inline-block;">${item.tag}</div>` : '';
          const dateStr = item.date || '';

          return `    <a href="guides/${item.category}/${item.id}/" class="list-item-card" style="display:flex; flex-direction:row; padding:14px 0; border-bottom:1px solid var(--line); text-decoration:none; transition:all 0.2s ease; align-items:center;">
          <div class="list-thumb" style="width:96px; height:72px; flex-shrink:0; border-radius:12px; background:#f1f5f9; overflow:hidden; margin-right:14px;">
            <img src="${thumb}" alt="${title}" onerror="this.onerror=null;this.src='https://www.koricare.kr/link/koricare_main_logo_nobg.png';" style="width:100%; height:100%; object-fit:cover; display:block;">
          </div>
          <div style="display:flex; flex-direction:column; flex:1; justify-content:center;">
            <div>${badgeHtml}</div>
            <div class="list-title" style="font-size:16px; font-weight:700; color:var(--ink); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word;">${title}</div>
            <div style="font-size:13px; color:var(--sub); margin-top:6px; font-weight:500;">Kori Care Guide &middot; ${dateStr}</div>
          </div>
        </a>`;
        }).join('\n');
        
        let viewAllText = lang === 'th' ? 'ดูคู่มือทั้งหมด ➔' : 'Xem tất cả Hướng dẫn ➔';
        let up = c.slice(0, c.indexOf(startM) + startM.length) + 
          '\n  <div class="news-list" id="guide-list" style="display:flex; flex-direction:column; margin-bottom:28px;">\n' + 
          langCards + 
          `\n    <a href="guides/index.html" style="display:flex; justify-content:center; align-items:center; gap:8px; padding:14px; background:#ffffff; color:#1e40af; border:1.5px solid #bfdbfe; border-radius:14px; font-weight:800; font-size:15px; text-decoration:none; margin-top:16px; transition:all 0.2s ease; box-shadow:0 2px 6px rgba(37,99,235,0.06);" onmouseover="this.style.background='#eff6ff'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(37,99,235,0.12)';" onmouseout="this.style.background='#ffffff'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 6px rgba(37,99,235,0.06)';">${viewAllText}</a>\n  </div>\n  ` + c.slice(c.indexOf(endM));
        fs.writeFileSync(p, up, 'utf-8');
      }
    });

    console.log('[Success] index.html and lang/index.html guide cards synced!');
  }
}

buildGuides();
