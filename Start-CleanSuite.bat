@echo off
title FB CleanSuite - 1-Click Launcher
color 0b
cls

echo ========================================================
echo               FB CleanSuite - 1-Click Launcher
echo       All-in-One Facebook Automation & Privacy Suite
echo ========================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Node.js is not installed or not in your system PATH!
    echo Please download and install Node.js (LTS version) from https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [*] First-time launch detected! Installing dependencies...
    echo [*] Please wait a moment while npm installs packages...
    call npm install
    if %errorlevel% neq 0 (
        color 0c
        echo.
        echo [ERROR] Failed to install dependencies. Check your internet connection and try again.
        pause
        exit /b 1
    )
    echo.
    echo [*] Dependencies installed successfully!
    echo.
)

echo [*] Starting FB CleanSuite server on http://localhost:3000 ...
echo [*] Localhost security: Private, zero external telemetry.
echo.

start "" "http://localhost:3000"
call npm run dev

pause
