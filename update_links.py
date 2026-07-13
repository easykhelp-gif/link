# -*- coding: utf-8 -*-
import csv
import json
import os
import re
import sys

# Define valid categories according to index.html structure
VALID_CATEGORIES = {"embassy", "admin", "remittance", "telecom", "hospital", "support"}

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "links.csv")
JSON_PATH = os.path.join(BASE_DIR, "data", "links.json")

def validate_and_convert():
    print("=" * 60)
    print(" Kori Care - 데이터 검증 및 배포 프로그램")
    print("=" * 60)
    
    if not os.path.exists(CSV_PATH):
        print(f"[Error] CSV 파일이 존재하지 않습니다: {CSV_PATH}")
        print("구글 스프레드시트에서 [파일 -> 다운로드 -> 쉼표 구분 값(.csv)]으로")
        print("다운로드받아 data 폴더에 'links.csv'라는 이름으로 넣어주세요.")
        sys.exit(1)
        
    print(f"[Info] CSV 파일 로드 중: {CSV_PATH}")
    
    items = []
    errors = []
    
    # Open CSV with UTF-8 encoding
    try:
        with open(CSV_PATH, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            # Check headers
            required_headers = {"id", "category", "name_ko", "name_th", "url"}
            missing_headers = required_headers - set(reader.fieldnames or [])
            if missing_headers:
                print(f"[Error] CSV 필수 헤더(열)가 누락되었습니다: {missing_headers}")
                print("필수 헤더: id, category, name_ko, name_th, url, desc_th, desc_en, tags")
                sys.exit(1)
                
            for idx, row in enumerate(reader, start=2): # 1-indexed header is line 1
                row_id = row.get("id", "").strip()
                category = row.get("category", "").strip()
                name_ko = row.get("name_ko", "").strip()
                name_th = row.get("name_th", "").strip()
                url = row.get("url", "").strip()
                desc_th = row.get("desc_th", "").strip()
                desc_en = row.get("desc_en", "").strip()
                tags_str = row.get("tags", "").strip()
                
                # Check empty row
                if not any([row_id, category, name_ko, name_th, url]):
                    continue
                
                # Validation rules
                row_errors = []
                
                if not row_id:
                    row_errors.append("아이디(id)가 누락되었습니다.")
                if not category:
                    row_errors.append("카테고리(category)가 누락되었습니다.")
                elif category not in VALID_CATEGORIES:
                    row_errors.append(f"허용되지 않은 카테고리입니다: '{category}' (허용 카테고리: {list(VALID_CATEGORIES)})")
                    
                if not name_ko:
                    row_errors.append("한국어 명칭(name_ko)이 누락되었습니다.")
                if not name_th:
                    row_errors.append("태국어 명칭(name_th)이 누락되었습니다.")
                    
                if not url:
                    row_errors.append("URL(url)이 누락되었습니다.")
                elif not (url.startswith("http://") or url.startswith("https://") or url.startswith("tel:")):
                    row_errors.append(f"올바르지 않은 URL 형식입니다: '{url}' (http://, https:// 또는 tel: 로 시작해야 합니다.)")
                
                if row_errors:
                    errors.append(f"[행 {idx} - ID: {row_id or '없음'}]")
                    for err in row_errors:
                        errors.append(f"  - {err}")
                else:
                    # Convert comma separated tags to list
                    tags = [t.strip() for t in re.split(r'[,\s]+', tags_str) if t.strip()] if tags_str else []
                    
                    item = {
                        "id": row_id,
                        "category": category,
                        "name_ko": name_ko,
                        "name_th": name_th,
                        "url": url,
                        "desc_th": desc_th,
                        "desc_en": desc_en,
                        "tags": tags
                    }
                    items.append(item)
                    
    except Exception as e:
        print(f"[Error] CSV 파일을 읽는 도중 오류가 발생했습니다: {str(e)}")
        sys.exit(1)
        
    if errors:
        print("\n" + "!" * 50)
        print(" 데이터 검증 오류 발생 (배포가 차단되었습니다.)")
        print("!" * 50)
        for err in errors:
            print(err)
        print("\nCSV 데이터를 수정한 뒤 프로그램을 다시 실행해주세요.")
        sys.exit(1)
        
    # Write to links.json
    try:
        with open(JSON_PATH, mode='w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print("\n" + "=" * 60)
        print(" 데이터 배포 완료! (links.json 업데이트 성공)")
        print(f" 총 {len(items)}개의 링크가 성공적으로 반영되었습니다.")
        print("=" * 60)
    except Exception as e:
        print(f"[Error] JSON 파일을 쓰는 동안 오류가 발생했습니다: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    validate_and_convert()
