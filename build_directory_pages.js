const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const MIN_PLACES = 5;
const { toEnglish } = require('../lib/korean_romanize.js');

const LANGS = ['en', 'th', 'vi'];
const CATEGORIES = ['hospital', 'restaurant', 'support', 'government'];

const ADJACENCY_MAP = {
  seoul: ['gyeonggi', 'incheon'],
  gyeonggi: ['seoul', 'incheon', 'chungnam', 'chungbuk', 'gangwon'],
  incheon: ['seoul', 'gyeonggi'],
  gangwon: ['gyeonggi', 'chungbuk', 'gyeongbuk'],
  chungbuk: ['gyeonggi', 'gangwon', 'gyeongbuk', 'chungnam', 'daejeon', 'sejong', 'jeonbuk'],
  chungnam: ['gyeonggi', 'chungbuk', 'sejong', 'daejeon', 'jeonbuk'],
  sejong: ['chungnam', 'chungbuk', 'daejeon'],
  daejeon: ['chungnam', 'chungbuk', 'sejong'],
  jeonbuk: ['chungnam', 'chungbuk', 'gyeongnam', 'jeonnam', 'gwangju'],
  gwangju: ['jeonnam', 'jeonbuk'],
  jeonnam: ['jeonbuk', 'gwangju', 'gyeongnam'],
  gyeongbuk: ['gangwon', 'chungbuk', 'jeonbuk', 'gyeongnam', 'daegu', 'ulsan'],
  daegu: ['gyeongbuk', 'gyeongnam'],
  gyeongnam: ['gyeongbuk', 'jeonbuk', 'jeonnam', 'daegu', 'ulsan', 'busan'],
  busan: ['gyeongnam', 'ulsan'],
  ulsan: ['gyeongbuk', 'gyeongnam', 'busan'],
  jeju: ['jeonnam']
};

const CATEGORY_NAMES = {
  hospital: { en: 'Hospitals', th: 'โรงพยาบาล', vi: 'Bệnh viện' },
  restaurant: { en: 'Restaurants', th: 'ร้านอาหาร', vi: 'Nhà hàng' },
  mobile: { en: 'Mobile Shops', th: 'ร้านมือถือ', vi: 'Cửa hàng điện thoại' },
  finance: { en: 'Banks & Finance', th: 'ธนาคารและการเงิน', vi: 'Ngân hàng & Tài chính' },
  support: { en: 'Support Centers', th: 'ศูนย์ช่วยเหลือ', vi: 'Trung tâm hỗ trợ' },
  government: { en: 'Government Offices', th: 'หน่วยงานรัฐบาล', vi: 'Cơ quan chính phủ' }
};

const REGION_NAMES = {
  seoul: { en: 'Seoul', th: 'โซล', vi: 'Seoul' },
  busan: { en: 'Busan', th: 'ปูซาน', vi: 'Busan' },
  incheon: { en: 'Incheon', th: 'อินชอน', vi: 'Incheon' },
  daegu: { en: 'Daegu', th: 'แทกู', vi: 'Daegu' },
  daejeon: { en: 'Daejeon', th: 'แทจอน', vi: 'Daejeon' },
  gwangju: { en: 'Gwangju', th: 'ควังจู', vi: 'Gwangju' },
  ulsan: { en: 'Ulsan', th: 'อุลซาน', vi: 'Ulsan' },
  sejong: { en: 'Sejong', th: 'เซจง', vi: 'Sejong' },
  gyeonggi: { en: 'Gyeonggi', th: 'คยองกี', vi: 'Gyeonggi' },
  gangwon: { en: 'Gangwon', th: 'คังวอน', vi: 'Gangwon' },
  chungbuk: { en: 'Chungbuk', th: 'ชุงบุก', vi: 'Chungbuk' },
  chungnam: { en: 'Chungnam', th: 'ชุงนัม', vi: 'Chungnam' },
  jeonbuk: { en: 'Jeonbuk', th: 'ชอนบุก', vi: 'Jeonbuk' },
  jeonnam: { en: 'Jeonnam', th: 'ชอนนัม', vi: 'Jeonnam' },
  gyeongbuk: { en: 'Gyeongbuk', th: 'คยองบุก', vi: 'Gyeongbuk' },
  gyeongnam: { en: 'Gyeongnam', th: 'คยองนัม', vi: 'Gyeongnam' },
  jeju: { en: 'Jeju', th: 'เชจู', vi: 'Jeju' }
};

const BOILERPLATES = {
  hospital: {
    en: "Accessing healthcare in Korea is straightforward if you bring your Alien Registration Card (ARC) and National Health Insurance card. Most major medical centers have an international clinic. For immediate medical emergencies, always dial 1339 or 119 for assistance in multiple languages. It is highly recommended to communicate your symptoms clearly and verify your insurance coverage prior to any major treatments.",
    th: "การเข้าถึงบริการด้านสุขภาพในเกาหลีนั้นทำได้ง่ายหากคุณนำบัตรประจำตัวคนต่างด้าว (ARC) และบัตรประกันสุขภาพแห่งชาติไปด้วย ศูนย์การแพทย์หลักส่วนใหญ่มีคลินิกนานาชาติ สำหรับกรณีฉุกเฉินทางการแพทย์ทันที โปรดโทร 1339 หรือ 119 เสมอเพื่อขอความช่วยเหลือในหลายภาษา ขอแนะนำอย่างยิ่งให้สื่อสารอาการของคุณอย่างชัดเจนและตรวจสอบความคุ้มครองประกันของคุณก่อนการรักษาที่สำคัญ",
    vi: "Tiếp cận dịch vụ chăm sóc sức khỏe ở Hàn Quốc rất đơn giản nếu bạn mang theo Thẻ đăng ký người nước ngoài (ARC) và thẻ Bảo hiểm y tế quốc gia. Hầu hết các trung tâm y tế lớn đều có phòng khám quốc tế. Đối với các trường hợp khẩn cấp y tế ngay lập tức, hãy luôn quay số 1339 hoặc 119 để được hỗ trợ đa ngôn ngữ. Rất khuyến khích thông báo rõ ràng các triệu chứng của bạn và kiểm tra bảo hiểm của bạn trước khi điều trị."
  },
  restaurant: {
    en: "Finding authentic local and international cuisine is easier than ever. When dining out, remember that tipping is not practiced in Korea, and side dishes (banchan) are typically refilled for free. Many local communities gather around these popular eateries, making them great spots for networking and experiencing home-cooked meals abroad.",
    th: "การหาร้านอาหารท้องถิ่นและนานาชาติแท้ๆ ทำได้ง่ายกว่าที่เคย เมื่อรับประทานอาหารนอกบ้าน โปรดจำไว้ว่าเกาหลีไม่มีธรรมเนียมการให้ทิป และเครื่องเคียง (พันชัน) มักจะเติมฟรี ชุมชนท้องถิ่นหลายแห่งรวมตัวกันรอบๆ ร้านอาหารยอดนิยมเหล่านี้ ทำให้เป็นสถานที่ที่เหมาะสำหรับการสร้างเครือข่ายและสัมผัสกับอาหารปรุงเองในต่างประเทศ",
    vi: "Tìm kiếm ẩm thực địa phương và quốc tế đích thực dễ dàng hơn bao giờ hết. Khi đi ăn ngoài, hãy nhớ rằng không có văn hóa tiền boa ở Hàn Quốc và các món ăn kèm (banchan) thường được nạp lại miễn phí. Nhiều cộng đồng địa phương tập trung quanh các quán ăn nổi tiếng này, khiến chúng trở thành điểm lý tưởng để kết nối và thưởng thức bữa ăn như ở nhà."
  },
  mobile: {
    en: "Setting up your mobile phone and internet connection in Korea requires your passport or ARC. Prepaid plans are easily accessible for short-term visitors, while post-paid plans offer better value for long-term residents. Many specialized shops provide contracts tailored to expats with support for international roaming and quick activation.",
    th: "การตั้งค่าโทรศัพท์มือถือและการเชื่อมต่ออินเทอร์เน็ตในเกาหลีต้องใช้หนังสือเดินทางหรือ ARC ของคุณ แผนเติมเงินสามารถเข้าถึงได้ง่ายสำหรับผู้เยี่ยมชมระยะสั้น ในขณะที่แผนรายเดือนให้ความคุ้มค่ากว่าสำหรับผู้พำนักระยะยาว ร้านค้าเฉพาะทางหลายแห่งเสนอสัญญาที่เหมาะกับชาวต่างชาติพร้อมรองรับการโรมมิ่งระหว่างประเทศและการเปิดใช้งานที่รวดเร็ว",
    vi: "Việc thiết lập điện thoại di động và kết nối internet ở Hàn Quốc yêu cầu hộ chiếu hoặc thẻ ARC của bạn. Các gói trả trước dễ dàng tiếp cận đối với khách ngắn hạn, trong khi các gói trả sau mang lại giá trị tốt hơn cho cư dân dài hạn. Nhiều cửa hàng chuyên biệt cung cấp các hợp đồng phù hợp với người nước ngoài với hỗ trợ chuyển vùng quốc tế và kích hoạt nhanh chóng."
  },
  finance: {
    en: "Opening a bank account or sending money overseas usually requires a valid ARC, passport, and sometimes proof of employment. Look for branches designated as foreign exchange centers, as they offer lower remittance fees and dedicated English-speaking tellers. Always double-check current exchange rates and transfer limits before initiating international transactions.",
    th: "การเปิดบัญชีธนาคารหรือโอนเงินไปต่างประเทศมักจะต้องใช้ ARC หนังสือเดินทาง และบางครั้งต้องใช้เอกสารรับรองการทำงาน มองหาสาขาที่กำหนดให้เป็นศูนย์แลกเปลี่ยนเงินตราต่างประเทศ เนื่องจากมีค่าธรรมเนียมการโอนที่ถูกกว่าและมีพนักงานที่พูดภาษาอังกฤษโดยเฉพาะ โปรดตรวจสอบอัตราแลกเปลี่ยนปัจจุบันและวงเงินการโอนก่อนเริ่มทำธุรกรรมระหว่างประเทศเสมอ",
    vi: "Mở tài khoản ngân hàng hoặc gửi tiền ra nước ngoài thường yêu cầu thẻ ARC hợp lệ, hộ chiếu và đôi khi là giấy chứng nhận việc làm. Tìm các chi nhánh được chỉ định là trung tâm ngoại hối vì chúng cung cấp phí chuyển tiền thấp hơn và nhân viên giao dịch nói tiếng Anh chuyên trách. Luôn kiểm tra kỹ tỷ giá hiện tại và hạn mức chuyển tiền trước khi bắt đầu giao dịch quốc tế."
  },
  support: {
    en: "Migrant support centers are invaluable resources for settling into Korean life. They offer free Korean language classes, legal counseling, labor rights education, and cultural exchange programs. Do not hesitate to contact them if you face workplace disputes or visa-related confusion, as they operate specifically to protect foreign residents' rights.",
    th: "ศูนย์ช่วยเหลือผู้ย้ายถิ่นเป็นทรัพยากรที่มีค่ามากสำหรับการตั้งถิ่นฐานในชีวิตในเกาหลี พวกเขาเสนอชั้นเรียนภาษาเกาหลีฟรี การให้คำปรึกษาทางกฎหมาย การศึกษาด้านสิทธิแรงงาน และโปรแกรมแลกเปลี่ยนวัฒนธรรม อย่าลังเลที่จะติดต่อพวกเขาหากคุณเผชิญกับข้อพิพาทในสถานที่ทำงานหรือความสับสนเกี่ยวกับวีซ่า เนื่องจากพวกเขาทำงานเพื่อปกป้องสิทธิของชาวต่างชาติโดยเฉพาะ",
    vi: "Các trung tâm hỗ trợ người di cư là nguồn tài nguyên vô giá để hòa nhập vào cuộc sống ở Hàn Quốc. Họ cung cấp các lớp học tiếng Hàn miễn phí, tư vấn pháp lý, giáo dục quyền lao động và các chương trình trao đổi văn hóa. Đừng ngần ngại liên hệ với họ nếu bạn gặp tranh chấp tại nơi làm việc hoặc nhầm lẫn liên quan đến thị thực, vì họ hoạt động đặc biệt để bảo vệ quyền lợi của người nước ngoài."
  },
  government: {
    en: "Handling visas, tax returns, and civil registrations is done through local government offices or the immigration office. Booking a visit through the HiKorea portal is mandatory for most immigration tasks. Bring all required photocopies to save time, and utilize the global call center 1345 if you are unsure about the required documents.",
    th: "การจัดการวีซ่า การคืนภาษี และการลงทะเบียนพลเรือนดำเนินการผ่านสำนักงานรัฐบาลท้องถิ่นหรือสำนักงานตรวจคนเข้าเมือง การจองเวลาเข้าเยี่ยมผ่านพอร์ทัล HiKorea เป็นข้อบังคับสำหรับงานตรวจคนเข้าเมืองส่วนใหญ่ นำสำเนาที่จำเป็นทั้งหมดมาด้วยเพื่อประหยัดเวลา และใช้ศูนย์บริการทั่วโลก 1345 หากคุณไม่แน่ใจเกี่ยวกับเอกสารที่จำเป็น",
    vi: "Việc xử lý thị thực, khai thuế và đăng ký hộ tịch được thực hiện thông qua các văn phòng chính quyền địa phương hoặc văn phòng nhập cư. Việc đặt lịch hẹn qua cổng thông tin HiKorea là bắt buộc đối với hầu hết các nhiệm vụ nhập cư. Mang theo tất cả các bản sao cần thiết để tiết kiệm thời gian và sử dụng trung tâm cuộc gọi toàn cầu 1345 nếu bạn không chắc chắn về các tài liệu cần thiết."
  }
};

function generateDynamicContent(lang, region, category, places) {
  const count = places.length;
  
  const districtCounts = {};
  places.forEach(p => {
    const parts = (p.address || "").split(' ');
    if (parts.length >= 2) {
      const district = parts[1]; 
      districtCounts[district] = (districtCounts[district] || 0) + 1;
    }
  });
  const topDistricts = Object.entries(districtCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => toEnglish(entry[0]));

  const topFacilities = places.slice(0, 2).map(p => {
    if (lang === 'en') return p.name_en || p.name_ko;
    return p.name_ko;
  });

  const catName = CATEGORY_NAMES[category][lang];
  const regName = REGION_NAMES[region][lang];
  
  if (lang === 'en') {
    return `In ${regName}, we have compiled a list of ${count} ${catName.toLowerCase()}. A significant concentration of these facilities can be found in key districts such as ${topDistricts.join(', ')}. For instance, establishments like ${topFacilities.join(' and ')} are included in the directory. The comprehensive list below includes addresses, contact information, and direct Kakao Map links to help you navigate within ${regName}.`;
  }
  if (lang === 'th') {
    return `ใน ${regName} เราได้รวบรวมสถานที่ประเภท ${catName} จำนวน ${count} แห่ง สถานที่เหล่านี้ส่วนใหญ่กระจุกตัวอยู่ในเขตเช่น ${topDistricts.join(', ')} ยกตัวอย่างเช่น สถานที่อย่าง ${topFacilities.join(' และ ')} ได้รวมอยู่ในไดเรกทอรีนี้ รายการด้านล่างนี้ประกอบด้วยที่อยู่ หมายเลขติดต่อ และลิงก์ Kakao Map เพื่อช่วยให้คุณเดินทางภายใน ${regName}`;
  }
  if (lang === 'vi') {
    return `Tại ${regName}, chúng tôi đã tổng hợp danh sách ${count} địa điểm thuộc danh mục ${catName.toLowerCase()}. Một lượng lớn các cơ sở này tập trung ở các quận như ${topDistricts.join(', ')}. Ví dụ, các cơ sở như ${topFacilities.join(' và ')} được bao gồm trong thư mục. Danh sách dưới đây bao gồm địa chỉ, thông tin liên hệ và các liên kết Kakao Map để giúp bạn điều hướng trong ${regName}.`;
  }
}

function buildHTML(lang, region, category, places, generatedDirs) {
  const catName = CATEGORY_NAMES[category][lang];
  const regName = REGION_NAMES[region][lang];
  let title, description;
  if (lang === 'en') {
    title = `${catName} in ${regName} (2026) - Kori Care`;
    description = `Explore ${places.length} ${catName.toLowerCase()} in ${regName}. Find addresses, phone numbers, and locations.`;
  } else if (lang === 'th') {
    title = `${catName}ใน${regName} (2026) - Kori Care`;
    description = `สำรวจ ${catName} ${places.length} แห่งใน${regName} พร้อมที่อยู่และเบอร์โทรศัพท์`;
  } else if (lang === 'vi') {
    title = `${catName} tại ${regName} (2026) - Kori Care`;
    description = `Khám phá ${places.length} ${catName.toLowerCase()} tại ${regName} kèm theo địa chỉ và số điện thoại.`;
  }
  
  const contentBoilerplate = BOILERPLATES[category][lang];
  const contentDynamic = generateDynamicContent(lang, region, category, places);
  
  let hreflangs = `<link rel="alternate" hreflang="x-default" href="https://www.koricare.kr/link/en/${region}/${category}/" />\n  `;
  hreflangs += LANGS.map(l => 
    `<link rel="alternate" hreflang="${l}" href="https://www.koricare.kr/link/${l}/${region}/${category}/" />`
  ).join('\n  ');

  // 1345 는 외국인종합안내센터 번호다. 수집 당시 전화번호가 없던 업소에 채워진 값이라
  // 실제 업소 번호가 아니다. 표시하지도, 구조화 데이터에 넣지도 않는다.
  const realPhone = (p) => {
    const v = (p.telephone || p.phone || '').trim();
    return v === '1345' ? '' : v;
  };

  // JSON-LD
  const itemListElements = places.map((p, idx) => ({
    "@type": "ListItem",
    "position": idx + 1,
    "item": {
      "@type": "LocalBusiness",
      "name": p.name_en || p.name_ko,
      "address": p.address,
      "telephone": realPhone(p),
      "url": p.map_url || ""
    }
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": itemListElements
  };

  let exploreMoreText, exploreNearbyText;
  if (lang === 'en') {
    exploreMoreText = `Explore More in ${regName}`;
    exploreNearbyText = `Explore ${catName} Nearby`;
  } else if (lang === 'th') {
    exploreMoreText = `สำรวจเพิ่มเติมใน${regName}`;
    exploreNearbyText = `สำรวจ${catName}ใกล้เคียง`;
  } else if (lang === 'vi') {
    exploreMoreText = `Khám phá thêm tại ${regName}`;
    exploreNearbyText = `Khám phá ${catName.toLowerCase()} lân cận`;
  }

  let sameRegionLinks = CATEGORIES.filter(c => c !== category && generatedDirs[`${lang}/${region}/${c}`])
    .slice(0, 5)
    .map(c => {
      let linkText;
      if(lang === 'en') linkText = `${CATEGORY_NAMES[c][lang]} in ${regName}`;
      else if(lang === 'th') linkText = `${CATEGORY_NAMES[c][lang]}ใน${regName}`;
      else linkText = `${CATEGORY_NAMES[c][lang]} tại ${regName}`;
      return `<li><a href="/link/${lang}/${region}/${c}/">${linkText}</a></li>`;
    })
    .join('');
    
  let otherRegionLinks = (ADJACENCY_MAP[region] || [])
    .filter(r => generatedDirs[`${lang}/${r}/${category}`])
    .slice(0, 5)
    .map(r => {
      let linkText;
      if(lang === 'en') linkText = `${catName} in ${REGION_NAMES[r][lang]}`;
      else if(lang === 'th') linkText = `${catName}ใน${REGION_NAMES[r][lang]}`;
      else linkText = `${catName} tại ${REGION_NAMES[r][lang]}`;
      return `<li><a href="/link/${lang}/${r}/${category}/">${linkText}</a></li>`;
    })
    .join('');

  let placesHTML = places.map(p => `
    <div class="place-card" style="border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:16px;">
      <h3 style="margin-top:0; color:#0f172a;">${p.name_en || p.name_ko}</h3>
      ${p.name_en && p.name_ko && p.name_en !== p.name_ko ? `<p style="color:#64748b; font-size:14px; margin:4px 0;">${p.name_ko}</p>` : ''}
      <p style="margin:8px 0;">📍 ${p.address}</p>
      ${realPhone(p) ? `<p style="margin:8px 0;">📞 ${realPhone(p)}</p>` : ''}
      <a href="${p.map_url}" target="_blank" style="color:#2563eb; text-decoration:none; font-weight:bold;">Kakao Map ➔</a>
    </div>
  `).join('');

  let backToPortalText;
  let backLink = `/link/${lang}/`;
  if (lang === 'en') {
      backToPortalText = '⬅ Back to Portal';
      backLink = `/link/`;
  }
  else if (lang === 'th') backToPortalText = '⬅ กลับสู่หน้าหลัก';
  else if (lang === 'vi') backToPortalText = '⬅ Quay lại Cổng thông tin';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="https://www.koricare.kr/link/${lang}/${region}/${category}/" />
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-YESCHJX46K"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-YESCHJX46K');
  </script>
  ${hreflangs}
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2)}
  </script>
  <style>
    body { font-family: 'Noto Sans', sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; margin:0; padding:20px; }
    .container { max-width: 800px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    h1 { color: #002366; }
    .seo-text { background: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .links-section { background: #e0f2fe; padding: 15px; border-radius: 8px; margin-top: 40px; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 8px; }
    a { color: #0284c7; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <a href="/link/${lang}/" style="display:inline-block; margin-bottom:20px;">${backToPortalText}</a>
    <h1>${title}</h1>
    <div class="seo-text">
      <p>${contentBoilerplate}</p>
      <p>${contentDynamic}</p>
    </div>
    
    <div class="places-list">
      ${placesHTML}
    </div>

    <div class="links-section">
      <h3>${exploreMoreText}</h3>
      <ul>${sameRegionLinks || '<li>No other categories found.</li>'}</ul>
      <h3>${exploreNearbyText}</h3>
      <ul>${otherRegionLinks || '<li>No nearby regions found.</li>'}</ul>
    </div>
  </div>
</body>
</html>`;
}

function main() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('region_') && f.endsWith('.json'));
  
  const dataMap = {};
  const generatedDirs = {}; 
  
  for (const file of files) {
    const region = file.replace('region_', '').replace('.json', '');
    const dataPath = path.join(DATA_DIR, file);
    const regionData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    dataMap[region] = {};
    CATEGORIES.forEach(c => dataMap[region][c] = []);
    
    regionData.places.forEach(p => {
      if (dataMap[region][p.category]) {
        dataMap[region][p.category].push(p);
      }
    });

    for (const category of CATEGORIES) {
      if (dataMap[region][category].length >= MIN_PLACES) {
        LANGS.forEach(lang => {
          generatedDirs[`${lang}/${region}/${category}`] = true;
        });
      }
    }
  }

  let generatedCount = 0;
  let sitemapUrls = [];

  for (const region of Object.keys(dataMap)) {
    for (const category of CATEGORIES) {
      const places = dataMap[region][category];
      if (places.length < MIN_PLACES) continue;

      for (const lang of LANGS) {
        const html = buildHTML(lang, region, category, places, generatedDirs);
        const outDir = path.join(BASE_DIR, lang, region, category);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf-8');
        generatedCount++;
        
        sitemapUrls.push({
          loc: `https://www.koricare.kr/link/${lang}/${region}/${category}/`,
          lastmod: new Date().toISOString().split('T')[0],
          changefreq: 'monthly',
          priority: '0.7'
        });
      }
    }
  }

  console.log(`✅ SEO Directory Build Complete: ${generatedCount} pages generated.`);
  
  const dirSitemapPath = path.join(DATA_DIR, 'directory_sitemap.json');
  fs.writeFileSync(dirSitemapPath, JSON.stringify(sitemapUrls, null, 2));
  console.log(`✅ Saved directory_sitemap.json to merge into sitemap.xml`);
}

main();
