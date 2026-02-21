@echo off
chcp 936 >nul
echo ========================================
echo       Novel Reader Server
echo ========================================
echo.
echo Starting server...
echo.
echo Visit: http://localhost:8000
echo.
echo Press Ctrl+C to stop
echo ========================================
echo.

python -m http.server 8000
pause
