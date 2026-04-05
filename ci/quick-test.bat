@echo off
REM Quick Docker reset and test runner for Windows

setlocal enabledelayedexpansion

echo.
echo ======================================
echo    TestTag Screenshot Tests
echo    Quick Docker Setup
echo ======================================
echo.

if "%WORDPRESS_PORT%"=="" set "WORDPRESS_PORT=8080"
if "%TEST_URL%"=="" set "TEST_URL=http://localhost:%WORDPRESS_PORT%"

echo [*] Stopping Docker containers...
docker compose down -v 2>nul

echo [*] Waiting 5 seconds...
timeout /t 5 /nobreak

echo [*] Starting Docker containers (this takes 1-2 minutes on first run)...
docker compose up -d

echo [*] Waiting for WordPress to initialize (about 40 seconds)...
timeout /t 40 /nobreak

echo [*] Checking if WordPress is ready...
:wait_loop
curl -s %TEST_URL%/ -o nul
if errorlevel 1 (
    echo [*] WordPress not ready yet, waiting...
    timeout /t 5 /nobreak
    goto wait_loop
)

echo [+] WordPress is ready!
echo.
echo Running tests...
npm run test:screenshots -- --workers=1

pause
