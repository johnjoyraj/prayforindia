@echo off
title Daily Prayer Book for India
cd /d "%~dp0"

echo ================================================================
echo    Starting Daily Prayer Book for India Local Server...
echo ================================================================

start /b py server.py > server.log 2>&1

timeout /t 2 /nobreak >nul

start http://localhost:5174/

echo Server is active at http://localhost:5174/
echo To view portals:
echo   - Main 31-Day Prayer Guide: http://localhost:5174/index.html
echo   - Intercessor Portal:       http://localhost:5174/login.html
echo   - Admin Portal:             http://localhost:5174/admin.html
echo.
