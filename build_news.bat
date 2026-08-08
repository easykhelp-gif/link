@echo off
chcp 65001 > nul
set BASE_DIR=%~dp0
echo Kori Care 뉴스 번역기 및 SSG 빌더를 실행합니다...
python "%BASE_DIR%build_news.py"
pause
