@echo off
chcp 65001 >nul
python auto_add_novels.py
echo.
echo 正在更新 sitemap.xml 的最后修改日期...
python update_sitemap.py
echo.
pause
