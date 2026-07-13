@echo off
chcp 65001 > nul
set BASE_DIR=%~dp0
echo Kori Care 데이터 갱신기를 실행합니다...
python "%BASE_DIR%update_links.py"
pause
