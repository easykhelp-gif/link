@echo off
cd /d %~dp0
echo ==================================================
echo       Deploying Kori Care to GitHub (Live Site)...
echo ==================================================
git add .
git commit -m "Update Facebook news feed and randomize layout"
git push origin main
echo ==================================================
echo       Deployment complete! Live site will update in a minute.
echo ==================================================
pause
