# -*- coding: utf-8 -*-
import os
import sys
import json
import re
import datetime
import urllib.request
import xml.etree.ElementTree as ET

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
NEWS_DIR = os.path.join(BASE_DIR, "news")
TEMPLATE_PATH = os.path.join(BASE_DIR, "templates", "news_template.html")
INDEX_PATH = os.path.join(BASE_DIR, "index.html")
NEWS_LIST_PATH = os.path.join(DATA_DIR, "news_list.json")

# Ensure directories exist
for d in [DATA_DIR, NEWS_DIR]:
    if not os.path.exists(d):
        os.makedirs(d)

def load_env():
    """Load API keys and RSS configuration from .env file."""
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    val_str = val.strip()
                    if (val_str.startswith('"') and val_str.endswith('"')) or \
                       (val_str.startswith("'") and val_str.endswith("'")):
                        val_str = val_str[1:-1]
                    os.environ[key.strip()] = val_str

def call_gemini_api(prompt, api_key):
    """Calls Google Gemini API directly using built-in urllib."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {
        "Content-Type": "application/json"
    }
    data = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            text_response = res_data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text_response.strip())
    except Exception as e:
        print(f"[Error] Gemini API 호출 실패: {e}")
        return None

def process_post_with_ai(post_text, has_korean, api_key):
    """Decides whether to translate or format the post text using AI."""
    if has_korean:
        print("[Info] 한국어가 감지되어 태국어 번역 및 HTML 포맷팅을 진행합니다...")
        prompt = f"""You are a professional translator translating Korean government/immigration news for Thai nationals living in South Korea.
Translate the following raw text containing Korean into natural, legally accurate Thai.

Glossary:
- 비자 연장 -> ต่ออายุวีซ่า
- 불법 체류 -> พำนักอย่างผิดกฎหมาย
- 자진 출국 -> รายงานตัวกลับประเทศโดยสมัครใจ
- 종합안내센터 -> ศูนย์บริการข้อมูลสำหรับชาวต่างชาติ
- 하이코리아 -> HiKorea (ไฮ코เรีย)
- 체류 자격 -> สถานะการพำนัก
- 출입국관리사무소 -> สำนักงานตรวจคนเข้าเมือง
- 범칙금 -> ค่าปรับ

Output MUST be a raw JSON object with exactly two keys:
1. "title_th": A search-optimized Thai title.
2. "content_th": The translated content in Thai, formatted with simple HTML tags (like <p>, <strong>, <ul>, <li>). Do NOT use markdown.

Raw Text to Translate:
{post_text}

Output raw JSON:"""
    else:
        print("[Info] 태국어로 구성된 글이 감지되어 기사식 구조 및 HTML 포맷팅을 진행합니다...")
        prompt = f"""You are an editor for Kori Care, a web portal for Thai expats in South Korea.
Take the following raw social media post in Thai, and refine it into a clean, professional news article format.
Create a search-engine optimized title, and format the body content with clean HTML tags (like <p>, <strong>, <ul>, <li>).

Output MUST be a raw JSON object with exactly two keys:
1. "title_th": A clean, catchy Thai title (SEO optimized).
2. "content_th": The formatted body content in Thai, structured with simple HTML tags.

Raw Thai Post:
{post_text}

Output raw JSON:"""

    return call_gemini_api(prompt, api_key)

def generate_sitemap(existing_news):
    """Generates sitemap.xml for SEO indexing."""
    sitemap_path = os.path.join(BASE_DIR, "sitemap.xml")
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        '    <loc>https://koricare.kr/link</loc>',
        '    <changefreq>daily</changefreq>',
        '    <priority>1.0</priority>',
        '  </url>'
    ]
    for item in existing_news:
        news_id = item["id"]
        xml_lines.append('  <url>')
        xml_lines.append(f'    <loc>https://koricare.kr/link/news/{news_id}.html</loc>')
        xml_lines.append(f'    <lastmod>{item["date"]}</lastmod>')
        xml_lines.append('    <changefreq>monthly</changefreq>')
        xml_lines.append('    <priority>0.8</priority>')
        xml_lines.append('  </url>')
    xml_lines.append('</urlset>')
    
    with open(sitemap_path, "w", encoding="utf-8") as f:
        f.write("\n".join(xml_lines))

def main():
    print("=" * 60)
    print(" 🚀 Kori Care - 페이스북 RSS 연동 자동 뉴스 빌더 (Auto-SSG)")
    print("=" * 60)
    
    load_env()
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    rss_url = os.environ.get("FB_RSS_URL")
    
    if not api_key:
        print("[Error] .env 파일에 GEMINI_API_KEY 또는 OPENAI_API_KEY가 필요합니다.")
        return
        
    if not rss_url:
        print("[Error] .env 파일에 FB_RSS_URL (페이스북 RSS 피드 주소)가 설정되어 있지 않습니다.")
        print("Tip: rss.app 이나 fetchrss.com 같은 무료 도구로 페이스북 페이지를 RSS 주소로 바꾼 뒤 .env에 기입하세요.")
        return

    # Load existing news
    existing_news = []
    if os.path.exists(NEWS_LIST_PATH):
        try:
            with open(NEWS_LIST_PATH, "r", encoding="utf-8") as f:
                existing_news = json.load(f)
        except Exception:
            existing_news = []

    # Fetch RSS Feed
    print(f"[Info] 페이스북 RSS 피드를 가져오는 중: {rss_url}")
    try:
        req = urllib.request.Request(rss_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as response:
            xml_data = response.read()
        root = ET.fromstring(xml_data)
    except Exception as e:
        print(f"[Error] RSS 피드 로드 중 오류 발생: {e}")
        return

    items = root.findall('.//item')
    print(f"[Info] 피드에서 {len(items)}개의 포스트를 발견했습니다.")
    
    new_posts_processed = 0
    
    # Process from oldest to newest in the feed slice to maintain order
    for item in reversed(items[:5]): # Process up to latest 5 items
        source_url = item.find('link').text.strip() if item.find('link') is not None else ""
        
        # Check if already processed
        already_exists = any(news.get("url") == source_url for news in existing_news)
        if already_exists:
            continue
            
        print(f"\n🆕 새 포스트 발견! 링크: {source_url}")
        description_elem = item.find('description')
        raw_text = description_elem.text.strip() if description_elem is not None else ""
        if not raw_text:
            continue
            
        # Clean text (strip HTML tags if any in RSS description)
        clean_text = re.sub(r'<[^>]+>', '', raw_text).strip()
        
        # Detect language (simple check: if has Korean alphabet)
        has_korean = bool(re.search('[ㄱ-ㅎㅏ-ㅣ가-힣]', clean_text))
        
        # Process with AI
        ai_res = process_post_with_ai(clean_text, has_korean, api_key)
        if not ai_res:
            print("[Warning] AI 처리 실패로 이 포스트는 건너뜁니다.")
            continue
            
        title_th = ai_res.get("title_th", "").strip()
        content_th = ai_res.get("content_th", "").strip()
        
        if not title_th or not content_th:
            continue
            
        # Generate ID and paths
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        date_id_prefix = datetime.date.today().strftime("%Y%m%d")
        
        serial = 1
        while True:
            candidate_id = f"{date_id_prefix}_{serial:02d}"
            if not os.path.exists(os.path.join(NEWS_DIR, f"{candidate_id}.html")):
                break
            serial += 1
            
        news_id = candidate_id
        news_file_path = os.path.join(NEWS_DIR, f"{news_id}.html")
        
        # Read template
        if not os.path.exists(TEMPLATE_PATH):
            print(f"[Error] 뉴스 템플릿이 없습니다: {TEMPLATE_PATH}")
            return
            
        with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
            template_content = f.read()
            
        url_section = (
            f'<a href="{source_url}" class="src-link" target="_blank" rel="noopener">'
            f'🔗 ดูประกาศต้นฉบับ (Facebook) / View Original Notice</a>'
        )
        
        # Replace templates placeholders
        html_rendered = template_content
        html_rendered = html_rendered.replace("{{TITLE_TH}}", title_th)
        html_rendered = html_rendered.replace("{{TITLE_KO}}", "Kori Care News Feed")
        html_rendered = html_rendered.replace("{{DATE}}", today_str)
        html_rendered = html_rendered.replace("{{CONTENT_TH}}", content_th)
        html_rendered = html_rendered.replace("{{CONTENT_KO}}", f"<p>본문 내용은 페이스북 원본 게시글을 확인해주세요.</p>")
        html_rendered = html_rendered.replace("{{URL_SECTION}}", url_section)
        html_rendered = html_rendered.replace("{{DESC_TH}}", title_th)
        html_rendered = html_rendered.replace("{{NEWS_ID}}", news_id)
        
        # Save HTML article
        with open(news_file_path, "w", encoding="utf-8") as f:
            f.write(html_rendered)
        print(f"[Success] 정적 기사 파일 저장 완료: news/{news_id}.html")
        
        # Append to news list
        new_item = {
            "id": news_id,
            "title_th": title_th,
            "title_ko": "Kori Care Facebook Post",
            "date": today_str,
            "url": source_url
        }
        existing_news.insert(0, new_item)
        new_posts_processed += 1
        
    if new_posts_processed > 0:
        # Save updated list
        with open(NEWS_LIST_PATH, "w", encoding="utf-8") as f:
            json.dump(existing_news, f, ensure_ascii=False, indent=2)
            
        generate_sitemap(existing_news)
        
        # Update index.html top 3 news cards
        if os.path.exists(INDEX_PATH):
            with open(INDEX_PATH, "r", encoding="utf-8") as f:
                index_content = f.read()
                
            start_marker = "<!-- NEWS_START -->"
            end_marker = "<!-- NEWS_END -->"
            
            start_idx = index_content.find(start_marker)
            end_idx = index_content.find(end_marker)
            
            if start_idx != -1 and end_idx != -1:
                latest_items = existing_news[:3]
                news_items_html = []
                for item in latest_items:
                    # Render beautiful news-card with images matching the layout
                    html = (
                        f'    <a href="news/{item["id"]}.html" class="news-card">\n'
                        f'      <img src="koricare_main_logo_nobg.png" alt="{item["title_th"]}">\n'
                        f'    </a>'
                    )
                    news_items_html.append(html)
                    
                news_block = "\n".join(news_items_html)
                updated_index = (
                    index_content[:start_idx + len(start_marker)] +
                    "\n" + news_block + "\n    " +
                    index_content[end_idx:]
                )
                
                with open(INDEX_PATH, "w", encoding="utf-8") as f:
                    f.write(updated_index)
                print("[Success] index.html 최신 뉴스 카드 갱신 주입 완료!")
                
        print(f"\n🎉 총 {new_posts_processed}개의 페이스북 새 글 동기화 완료!")
    else:
        print("\n✅ 동기화할 새로운 페이스북 포스트가 없습니다. 최신 상태입니다.")

if __name__ == "__main__":
    main()
