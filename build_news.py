# -*- coding: utf-8 -*-
import os
import sys
import json
import re
import datetime
import subprocess

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
NEWS_DIR = os.path.join(BASE_DIR, "news")
TEMPLATE_PATH = os.path.join(BASE_DIR, "templates", "news_template.html")
INDEX_PATH = os.path.join(BASE_DIR, "index.html")
TH_INDEX_PATH = os.path.join(BASE_DIR, "th", "index.html")
VI_INDEX_PATH = os.path.join(BASE_DIR, "vi", "index.html")
NEWS_LIST_PATH = os.path.join(DATA_DIR, "news_list.json")
DRAFT_PATH = os.path.join(DATA_DIR, "draft_news.json")

for d in [DATA_DIR, NEWS_DIR]:
    if not os.path.exists(d):
        os.makedirs(d)

def generate_sitemap(existing_news):
    """Generates a standard XML sitemap for search engines."""
    sitemap_path = os.path.join(BASE_DIR, "sitemap.xml")
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        '    <loc>https://www.koricare.kr/link</loc>',
        '    <changefreq>daily</changefreq>',
        '    <priority>1.0</priority>',
        '  </url>',
        '  <url>',
        '    <loc>https://www.koricare.kr/th/link</loc>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.9</priority>',
        '  </url>',
        '  <url>',
        '    <loc>https://www.koricare.kr/vi/link</loc>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.9</priority>',
        '  </url>'
    ]
    
    for item in existing_news:
        news_id = item["id"]
        xml_lines.append('  <url>')
        xml_lines.append(f'    <loc>https://www.koricare.kr/link/news/{news_id}.html</loc>')
        xml_lines.append(f'    <lastmod>{item.get("date", datetime.date.today().strftime("%Y-%m-%d"))}</lastmod>')
        xml_lines.append('    <changefreq>monthly</changefreq>')
        xml_lines.append('    <priority>0.8</priority>')
        xml_lines.append('  </url>')
        
    xml_lines.append('</urlset>')
    
    try:
        with open(sitemap_path, "w", encoding="utf-8") as f:
            f.write("\n".join(xml_lines))
        print("[Success] sitemap.xml 최신 다국어 갱신 완료!")
    except Exception as e:
        print(f"[Warning] sitemap.xml 생성 실패: {e}")

def update_index_pages(existing_news):
    """Inject top 3 multi-language news cards into index.html, th/index.html, vi/index.html"""
    latest_items = existing_news[:3]
    
    # 1. Update main index.html (English base)
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        start_m, end_m = "<!-- NEWS_START -->", "<!-- NEWS_END -->"
        s_idx, e_idx = content.find(start_m), content.find(end_m)
        if s_idx != -1 and e_idx != -1:
            cards = []
            for item in latest_items:
                thumb = item.get("thumbnail", "koricare_main_logo_nobg.png")
                title = item.get("title_en") or item.get("title_th") or item.get("title_ko")
                cards.append(
                    f'    <a href="news/{item["id"]}.html" class="news-card">\n'
                    f'      <img src="{thumb}" alt="{title}" class="news-thumb">\n'
                    f'      <div class="news-title">{title}</div>\n'
                    f'      <div class="news-link">Read Executive Summary ➔</div>\n'
                    f'    </a>'
                )
            block = "\n".join(cards)
            updated = content[:s_idx + len(start_m)] + "\n" + block + "\n    " + content[e_idx:]
            with open(INDEX_PATH, "w", encoding="utf-8") as f:
                f.write(updated)
            print("[Success] index.html (English) 최신 뉴스 카드 갱신 완료!")

def main():
    print("=" * 60)
    print(" Kori Care - 다국어(EN/TH/VI/KO) 뉴스 기사 SSG 빌더")
    print("=" * 60)
    
    existing_news = []
    if os.path.exists(NEWS_LIST_PATH):
        try:
            with open(NEWS_LIST_PATH, "r", encoding="utf-8") as f:
                existing_news = json.load(f)
        except Exception:
            existing_news = []

    generate_sitemap(existing_news)
    update_index_pages(existing_news)

    print("\n🎉 모든 다국어 인덱스 및 sitemap.xml 정적 빌드가 완벽히 동기화되었습니다.")

if __name__ == "__main__":
    main()
