const fs = require('fs');
const path = require('path');

const filePath = path.join('c:/Users/y1611/Desktop/agent/temp_link_repo3/data/guides_list.json');
let data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

for (let guide of data) {
    if (guide.id === 'travel_seoul_free') {
        // English
        guide.content_en = guide.content_en.replace(
            "The regular entrance fee is 3,000 KRW, but if you rent and wear a traditional Korean Hanbok, <strong>entrance is 100% FREE!</strong>",
            "Palace entry is free with Hanbok, but Hanbok rental costs around 20,000~30,000 KRW. If you skip Hanbok, standard entry is just 3,000 KRW. The Hanbok must be a proper traditional set (top + bottom) to qualify for free entry."
        );
        guide.content_en = guide.content_en.replace(
            "<strong>Etiquette</strong>: Since real people live in these houses, visitors are strictly required to keep their voices low.",
            "<strong>Important Visiting Rules (2026)</strong>: Bukchon is a real residential area. Under Jongno-gu regulations, tourists are only allowed to visit the main Red Zone (Bukchon-ro 11-gil) between <strong>10:00 AM and 5:00 PM</strong>. Sundays are designated as a \"Tourist Rest Day\" (Do not visit on Sundays). Please keep noise to a minimum. Violators may face fines."
        );
        guide.content_en += '<br><br><span style="font-size:12px; color:#94a3b8;">(Source: Jongno-gu Office Bukchon Special Management Area Regulations)</span>';

        // Thai
        guide.content_th = guide.content_th.replace(
            "ค่าเข้าชมปกติคือ 3,000 วอน แต่ถ้าคุณเช่าและสวมชุดฮันบกเกาหลีแบบดั้งเดิม <strong>เข้าฟรี 100%!</strong>",
            "ค่าเข้าพระราชวังฟรีหากสวมชุดฮันบก แต่ค่าเช่าชุดฮันบกอยู่ที่ประมาณ 20,000~30,000 วอน หากไม่เช่าชุดฮันบก ค่าเข้าชมปกติเพียง 3,000 วอน นอกจากนี้ ชุดฮันบกจะต้องเป็นชุดดั้งเดิมที่ถูกต้อง (เสื้อ+กางเกง/กระโปรง) จึงจะเข้าฟรีได้"
        );
        guide.content_th = guide.content_th.replace(
            "<strong>มารยาท</strong>: เนื่องจากมีคนอาศัยอยู่ในบ้านเหล่านี้จริงๆ ผู้มาเยือนจึงต้องรักษาความเงียบอย่างเคร่งครัด",
            "<strong>กฎการเข้าชมที่สำคัญ (2026)</strong>: บุกชอนเป็นพื้นที่อยู่อาศัยจริง ตามกฎระเบียบของเขตจงโน อนุญาตให้นักท่องเที่ยวเข้าชมพื้นที่หลัก (Red Zone) ได้เฉพาะเวลา <strong>10:00 น. ถึง 17:00 น.</strong> วันอาทิตย์ถูกกำหนดให้เป็น \"วันหยุดพักผ่อนสำหรับนักท่องเที่ยว\" (ห้ามเยี่ยมชมในวันอาทิตย์) กรุณารักษาความเงียบ ผู้ฝ่าฝืนอาจถูกปรับ"
        );
        guide.content_th += '<br><br><span style="font-size:12px; color:#94a3b8;">(ที่มา: ข้อบังคับพื้นที่การจัดการพิเศษบุกชอน เขตจงโน)</span>';

        // Vietnamese
        guide.content_vi = guide.content_vi.replace(
            "Phí vào cửa thông thường là 3.000 KRW, nhưng nếu bạn thuê và mặc Hanbok truyền thống của Hàn Quốc, <strong>vé vào cửa MIỄN PHÍ 100%!</strong>",
            "Vé vào cung điện là miễn phí nếu mặc Hanbok, nhưng giá thuê Hanbok khoảng 20.000~30.000 KRW. Nếu bạn không thuê Hanbok, vé vào cửa thông thường chỉ có 3.000 KRW. Ngoài ra, Hanbok phải là bộ truyền thống đúng chuẩn (áo + quần/váy) mới được miễn phí vé."
        );
        guide.content_vi = guide.content_vi.replace(
            "<strong>Phép lịch sự</strong>: Vì có người dân thực sự sống trong những ngôi nhà này, du khách được yêu cầu nghiêm ngặt phải giữ trật tự.",
            "<strong>Quy định Tham quan Quan trọng (2026)</strong>: Bukchon là khu dân cư thực sự. Theo quy định của quận Jongno, khách du lịch chỉ được phép tham quan khu vực chính (Red Zone) từ <strong>10:00 Sáng đến 5:00 Chiều</strong>. Chủ nhật được chỉ định là \"Ngày nghỉ của Khách du lịch\" (Không tham quan vào Chủ nhật). Vui lòng giữ yên lặng. Người vi phạm có thể bị phạt tiền."
        );
        guide.content_vi += '<br><br><span style="font-size:12px; color:#94a3b8;">(Nguồn: Quy định Khu vực Quản lý Đặc biệt Bukchon, Văn phòng Quận Jongno)</span>';

    } else if (guide.id === 'travel_incheon_ocean') {
        // English
        guide.content_en = guide.content_en.replace(
            "8,000 KRW (Adult)</td><td>A scenic monorail around the island</td>",
            "8,000 KRW (Adult)</td><td>A scenic monorail around the island (Closed on Mondays)</td>"
        );
        guide.content_en = guide.content_en.replace(
            "5,500 KRW (per ride)</td>",
            "~ 5,000 - 6,000 KRW (Varies)</td>"
        );

        // Thai
        guide.content_th = guide.content_th.replace(
            "8,000 วอน (ผู้ใหญ่)</td><td>รถไฟโมโนเรลชมวิวรอบเกาะ</td>",
            "8,000 วอน (ผู้ใหญ่)</td><td>รถไฟโมโนเรลชมวิวรอบเกาะ (ปิดทำการวันจันทร์)</td>"
        );
        guide.content_th = guide.content_th.replace(
            "5,500 วอน (ต่อรอบ)</td>",
            "~ 5,000 - 6,000 วอน (แล้วแต่เครื่องเล่น)</td>"
        );

        // Vietnamese
        guide.content_vi = guide.content_vi.replace(
            "8,000 KRW (Người lớn)</td><td>Tàu điện trên cao ngắm cảnh quanh đảo</td>",
            "8,000 KRW (Người lớn)</td><td>Tàu điện trên cao ngắm cảnh quanh đảo (Đóng cửa vào Thứ Hai)</td>"
        );
        guide.content_vi = guide.content_vi.replace(
            "5,500 KRW (mỗi lượt)</td>",
            "~ 5,000 - 6,000 KRW (Tùy trò chơi)</td>"
        );
    }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
console.log('Successfully updated guides_list.json');
