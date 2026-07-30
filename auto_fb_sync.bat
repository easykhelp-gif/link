@echo off
cd /d %~dp0
echo ==================================================
echo       Running Kori Care Facebook RSS Sync (Node)...
echo ==================================================
node auto_fb_sync.js
echo.
pause
