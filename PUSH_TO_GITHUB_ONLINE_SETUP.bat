@echo off
title Push 4:00 AM WhatsApp Broadcaster to GitHub
cd /d "%~dp0"

echo ================================================================
echo   Pushing 4:00 AM Automated Broadcaster to GitHub Actions...
echo ================================================================

git status

echo.
echo Adding files...
git add cloud_sender.py .github/workflows/daily-4am-prayer.yml database.rules.json

echo Committing changes...
git commit -m "Add automated 4:00 AM Pray for India WhatsApp Broadcaster via GitHub Actions and Firebase"

echo Pushing to GitHub (origin main)...
git push origin main

if errorlevel 1 (
    echo.
    echo ✖ Git push failed. Please check your internet connection or git credentials.
    pause
    exit /b 1
)

echo.
echo ================================================================
echo   ✔ Successfully pushed to GitHub!
echo   GitHub Actions will now automatically trigger every day at 4:00 AM IST.
echo ================================================================
pause
