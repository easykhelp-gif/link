# -*- coding: utf-8 -*-
import os
import sys
import json
import re
import datetime
import subprocess
import urllib.request

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
NEWS_DIR = os.path.join(BASE_DIR, "news")
TEMPLATE_PATH = os.path.join(BASE_DIR, "templates", "news_template.html")
INDEX_PATH = os.path.join(BASE_DIR, "index.html")
NEWS_LIST_PATH = os.path.join(DATA_DIR, "news_list.json")
DRAFT_PATH = os.path.join(DATA_DIR, "draft_news.json")

# Ensure directories exist
for d in [DATA_DIR, NEWS_DIR]:
    if not os.path.exists(d):
        os.makedirs(d)

def load_env():
    """Custom light-weight .env loader to prevent external dependencies."""
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    # Strip quotes if present
                    val_str = val.strip()
                    if (val_str.startswith('"') and val_str.endswith('"')) or \
                       (val_str.startswith("'") and val_str.endswith("'")):
                        val_str = val_str[1:-1]
                    os.environ[key.strip()] = val_str

def call_openai_translation(title_ko, content_ko, api_key):
    """Calls OpenAI API directly via urllib without requiring third-party library installations."""
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    system_prompt = (
        "You are a professional translator translating Korean government/immigration news and announcements "
        "for Thai nationals living in South Korea.\n"
        "Your task is to translate the Korean title and content into natural, legally accurate Thai.\n\n"
        "Strictly adhere to the following glossary for key terminology:\n"
        "- 비자 연장 -> ต่ออายุวีซ่า\n"
        "- 불법 체류 -> พำนักอย่างผิดกฎหมาย\n"
        "- 자진 출국 -> รายงานตัวกลับประเทศโดยสมัครใจ\n"
        "- 종합안내센터 -> ศูนย์บริการข้อมูลสำหรับชาวต่างชาติ\n"
        "- 하이코리아 -> HiKorea (ไฮโคเรีย)\n"
        "- 체류 자격 -> สถานะการพำนัก\n"
        "- 출입국관리사무소 -> สำนักงานตรวจคนเข้าเมือง\n"
        "- 범칙금 -> ค่าปรับ\n\n"
        "Output MUST be a JSON object with the following keys:\n"
        "1. \"title_th\": The translated title in Thai.\n"
        "2. \"content_th\": The translated content in Thai, formatted with simple HTML tags (like <p>, <strong>, <ul>, <li>) "
        "to ensure beautiful rendering on mobile. Do NOT use markdown (like ** or - for lists), use HTML tags.\n\n"
        "Do not output any markdown codeblock formatting wrapper (like ```json ... ```) - output raw JSON text only."
    )
    
    user_prompt = f"Title Korean:\n{title_ko}\n\nContent Korean:\n{content_ko}"
    
    data = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"}
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        print("[Info] OpenAI 번역 요청 중 (Model: gpt-4o-mini)...")
        with urllib.request.urlopen(req, timeout=30) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            content = res_data["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as e:
        print(f"[Error] OpenAI API 호출 중 오류 발생: {e}")
        return None

def main():
    print("=" * 60)
    print(" Kori Care - 뉴스 번역 & 정적 기사 빌더 (SSG)")
    print("=" * 60)
    
    load_env()
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("[Warning] .env 파일 또는 시스템 환경변수에서 OPENAI_API_KEY를 찾을 수 없습니다.")
        api_key = input("OpenAI API Key를 입력해주세요 (엔터 누르면 수동 모드로 진입): ").strip()
    
    # 1. Inputs
    title_ko = input("한국어 제목을 입력하세요: ").strip()
    if not title_ko:
        print("[Error] 제목은 필수 항목입니다.")
        sys.exit(1)
        
    print("\n한국어 본문을 입력하세요 (입력이 끝나면 빈 줄에서 Enter를 한 번 더 누르거나 Ctrl+Z(Windows) 후 Enter를 누르세요):")
    content_ko_lines = []
    while True:
        try:
            line = input()
            content_ko_lines.append(line)
        except EOFError:
            break
        if not line and len(content_ko_lines) > 1 and content_ko_lines[-2] == "":
            # Stop if double enter
            content_ko_lines = content_ko_lines[:-1]
            break
            
    content_ko = "\n".join(content_ko_lines).strip()
    if not content_ko:
        print("[Error] 본문은 필수 항목입니다.")
        sys.exit(1)
        
    source_url = input("\n원문 링크(URL)가 있으면 입력하세요 (없으면 엔터): ").strip()
    
    title_th = ""
    content_th = ""
    
    # 2. Translation
    if api_key:
        translated = call_openai_translation(title_ko, content_ko, api_key)
        if translated:
            title_th = translated.get("title_th", "")
            content_th = translated.get("content_th", "")
        else:
            print("[Warning] AI 번역이 실패했습니다. 수동 번역 작성을 지원합니다.")
    else:
        print("[Info] API Key가 설정되지 않아 수동 번역 작성 모드로 진행합니다.")
        
    # Create draft
    draft_data = {
        "title_ko": title_ko,
        "content_ko": content_ko,
        "title_th": title_th or "[태국어 제목을 여기에 작성하세요]",
        "content_th": content_th or "<p>[태국어 본문을 HTML 형식을 활용해 여기에 작성하세요]</p>",
        "url": source_url
    }
    
    with open(DRAFT_PATH, "w", encoding="utf-8") as f:
        json.dump(draft_data, f, ensure_ascii=False, indent=2)
        
    # 3. Open Notepad for Admin review (Human-in-the-loop)
    print("\n" + "-" * 50)
    print(" [검수 단계] 번역 초안을 확인 및 수정합니다.")
    print(" 메모장(Notepad)이 자동으로 실행됩니다.")
    print(" 타이틀과 본문을 최종 수정 및 검수한 뒤 반드시 '저장(Ctrl+S)'을 누르고 메모장을 닫아주세요.")
    print("-" * 50)
    
    try:
        # Blocks until notepad is closed
        subprocess.run(["notepad.exe", DRAFT_PATH], check=True)
    except Exception as e:
        print(f"[Warning] 메모장 실행에 실패했습니다: {e}")
        print(f"직접 {DRAFT_PATH} 파일을 열어서 편집하고 저장한 후 엔터를 눌러주세요.")
        input("편집을 완료했다면 엔터를 눌러 계속 진행하십시오...")

    # 4. Read modified draft
    try:
        with open(DRAFT_PATH, "r", encoding="utf-8") as f:
            final_draft = json.load(f)
    except Exception as e:
        print(f"[Error] 수정된 초안 파일을 읽는 중 오류가 발생했습니다: {e}")
        sys.exit(1)
        
    title_th = final_draft.get("title_th", "").strip()
    content_th = final_draft.get("content_th", "").strip()
    title_ko = final_draft.get("title_ko", "").strip()
    content_ko = final_draft.get("content_ko", "").strip()
    source_url = final_draft.get("url", "").strip()
    
    if not title_th or title_th.startswith("[태국어 제목"):
        print("[Error] 태국어 제목이 올바르게 검수되지 않았습니다.")
        sys.exit(1)
        
    # Confirm publication
    pub_confirm = input("\n이 기사를 즉시 배포하시겠습니까? (Y/N): ").strip().upper()
    if pub_confirm != "Y":
        print("[Info] 배포가 취소되었습니다. 초안 파일은 data/draft_news.json에 보존됩니다.")
        sys.exit(0)
        
    # 5. Build static HTML page
    # Generate Date and ID
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    date_id_prefix = datetime.date.today().strftime("%Y%m%d")
    
    # Read existing news to determine serial number
    existing_news = []
    if os.path.exists(NEWS_LIST_PATH):
        try:
            with open(NEWS_LIST_PATH, "r", encoding="utf-8") as f:
                existing_news = json.load(f)
        except Exception:
            existing_news = []
            
    serial = 1
    while True:
        candidate_id = f"{date_id_prefix}_{serial:02d}"
        if not os.path.exists(os.path.join(NEWS_DIR, f"{candidate_id}.html")):
            break
        serial += 1
        
    news_id = candidate_id
    news_filename = f"{news_id}.html"
    news_file_path = os.path.join(NEWS_DIR, news_filename)
    
    # Read template
    if not os.path.exists(TEMPLATE_PATH):
        print(f"[Error] 뉴스 템플릿 파일이 존재하지 않습니다: {TEMPLATE_PATH}")
        sys.exit(1)
        
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        template_content = f.read()
        
    # Format URL section
    url_section = ""
    if source_url:
        url_section = (
            f'<a href="{source_url}" class="src-link" target="_blank" rel="noopener">'
            f'🔗 ดูประกาศต้นฉบับ (Source) / View Original Notice</a>'
        )
        
    # Replace templates placeholders
    html_rendered = template_content
    html_rendered = html_rendered.replace("{{TITLE_TH}}", title_th)
    html_rendered = html_rendered.replace("{{TITLE_KO}}", title_ko)
    html_rendered = html_rendered.replace("{{DATE}}", today_str)
    html_rendered = html_rendered.replace("{{CONTENT_TH}}", content_th)
    html_rendered = html_rendered.replace("{{CONTENT_KO}}", content_ko)
    html_rendered = html_rendered.replace("{{URL_SECTION}}", url_section)
    
    # Save static news file
    with open(news_file_path, "w", encoding="utf-8") as f:
        f.write(html_rendered)
    print(f"\n[Success] 정적 뉴스 기사 페이지 빌드 완료: news/{news_filename}")
    
    # 6. Update news_list.json
    new_item = {
        "id": news_id,
        "title_th": title_th,
        "title_ko": title_ko,
        "date": today_str,
        "url": source_url
    }
    
    # Insert at the beginning of the list (newest first)
    existing_news.insert(0, new_item)
    with open(NEWS_LIST_PATH, "w", encoding="utf-8") as f:
        json.dump(existing_news, f, ensure_ascii=False, indent=2)
        
    # 7. Update index.html (Inject top 3 news static links)
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, "r", encoding="utf-8") as f:
            index_content = f.read()
            
        start_marker = "<!-- NEWS_START -->"
        end_marker = "<!-- NEWS_END -->"
        
        start_idx = index_content.find(start_marker)
        end_idx = index_content.find(end_marker)
        
        if start_idx != -1 and end_idx != -1:
            # Build top 3 list
            latest_items = existing_news[:3]
            news_items_html = []
            for item in latest_items:
                # Path is news/{id}.html from the root of easyk_portal
                html = (
                    f'    <a href="news/{item["id"]}.html" class="news-item">\n'
                    f'      <div class="news-title">{item["title_th"]}</div>\n'
                    f'      <div class="news-date">{item["date"]}</div>\n'
                    f'    </a>'
                )
                news_items_html.append(html)
                
            if news_items_html:
                news_block = "\n".join(news_items_html)
            else:
                news_block = '    <div class="empty" style="padding:15px 0;">ยังไม่มีประกาศในขณะนี้ · No notices yet</div>'
                
            updated_index = (
                index_content[:start_idx + len(start_marker)] +
                "\n" + news_block + "\n    " +
                index_content[end_idx:]
            )
            
            with open(INDEX_PATH, "w", encoding="utf-8") as f:
                f.write(updated_index)
            print("[Success] index.html 최신 뉴스 갱신 주입 완료!")
        else:
            print("[Warning] index.html에서 <!-- NEWS_START --> 또는 <!-- NEWS_END --> 마커를 찾지 못해 인덱스 업데이트를 생략했습니다.")
    else:
        print(f"[Warning] index.html 파일이 존재하지 않습니다: {INDEX_PATH}")
        
    # Clean up draft
    if os.path.exists(DRAFT_PATH):
        os.remove(DRAFT_PATH)
        
    print("\n" + "=" * 60)
    print(" 🎉 뉴스 등록 및 정적 컴파일 성공 완료!")
    print(f" - 기사 ID: {news_id}")
    print(f" - 배포 위치: koricare.kr/link/news/{news_id}.html")
    print("=" * 60)

if __name__ == "__main__":
    main()
