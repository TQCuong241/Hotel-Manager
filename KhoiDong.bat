@echo off
title SRC Hotel Management System
echo ================================================
echo   KHACH SAN SRC - He Thong Quan Ly
echo ================================================
echo.
echo Dang khoi dong may chu...

:: Change to the directory where this script lives
cd /d "%~dp0"

:: Start the Node.js server in background
start "" /B node server.js

:: Wait 2 seconds for server to be ready
timeout /t 2 /nobreak >nul

echo May chu da san sang tai http://localhost:5000
echo.
echo Dang mo giao dien quan ly...

:: Open in default browser if Pake app is not found
if exist "SRC Hotel.exe" (
  start "" "SRC Hotel.exe"
) else (
  start "" "http://localhost:5000"
)

echo.
echo He thong dang chay. Dong cua so nay de tat may chu.
pause
