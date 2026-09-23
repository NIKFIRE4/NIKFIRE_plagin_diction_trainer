@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js не найден. Установите с https://nodejs.org и запустите снова. & pause & exit /b 1)
set ZV_LOOP=1
:loop
node zvukoryad-bridge.mjs %*
if %errorlevel%==75 (set ZV_RESTARTED=1& goto loop)
pause
