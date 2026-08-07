import os
import re
import urllib.request
import urllib.parse
import json
import xml.etree.ElementTree as ET
from datetime import datetime

# ==========================================
# KoriCare Thai HotNews Auto-Pipeline (v1.0)
# ==========================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORTAL_DIR = os.path.join(BASE_DIR, "koricare-portal")
NEWS_DIR = os.path.join(PORTAL_DIR, "news")
IMAGES_DIR = os.path.join(NEWS_DIR, "images")

os.makedirs(NEWS_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)

# 1. 3대 태국 뉴스 RSS 출처
RSS_FEEDS = [
    "https://www.khaosod.co.th/feed",
    "https://www.sanook.com/news/archive/rss/",
    "https://www.thairath.co.th/rss/news"
]

def fetch_rss_items():
    items = []
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    
    for url in RSS_FEEDS:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                xml_data = resp.read()
                root = ET.fromstring(xml_data)
                
                channel = root.find('channel')
                if channel is None:
                    continue
                    
                for elem in channel.findall('item'):
                    title = elem.findtext('title', '').strip()
                    link = elem.findtext('link', '').strip()
                    pub_date = elem.findtext('pubDate', '').strip()
                    description = elem.findtext('description', '').strip()
                    
                    # 썸네일 이미지 추출 (media:content or enclosure or img tag in description)
                    img_url = ""
                    enclosure = elem.find('enclosure')
                    if enclosure is not None and 'image' in enclosure.attrib.get('type', ''):
                        img_url = enclosure.attrib.get('url', '')
                    
                    if not img_url:
                        # description 내 <img src="..."> 파싱
                        img_match = re.search(r'src=["\'](https?://[^"\']+)["\']', description)
                        if img_match:
                            img_url = img_match.group(1)

                    if title and link:
                        items.append({
                            'title': title,
                            'link': link,
                            'pub_date': pub_date,
                            'description': re.sub('<[^<]+?>', '', description)[:200],
                            'img_url': img_url
                        })
        except Exception as e:
            print(f"RSS Fetch Error ({url}): {e}")
            
    return items

def process_hotnews_pipeline():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 태국 실시간 바이럴 뉴스 수집 시작...")
    raw_items = fetch_rss_items()
    print(f"총 {len(raw_items)}개 뉴스 수집 완료.")
    
    # 중복 제거 및 주요 탑토픽 선별 (샘플 테스트)
    selected_items = raw_items[:3] if len(raw_items) >= 3 else raw_items
    
    print("선정된 Top 3 이슈:")
    for idx, item in enumerate(selected_items, 1):
        print(f"  {idx}. {item['title']} (이미지: {item['img_url'] or '없음'})")
        
    return selected_items

if __name__ == "__main__":
    process_hotnews_pipeline()
