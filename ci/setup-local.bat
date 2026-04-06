@echo off
REM TestTag Screenshot Testing - Windows Setup

setlocal enabledelayedexpansion

echo.
echo TestTag Screenshot Testing - Setup
echo ======================================

if "%WORDPRESS_PORT%"=="" set "WORDPRESS_PORT=8080"
if "%TEST_URL%"=="" set "TEST_URL=http://localhost:%WORDPRESS_PORT%"

REM Check if Docker is running
docker version >nul 2>&1
if errorlevel 1 (
    echo X Docker is not running. Please start Docker first.
    exit /b 1
)

echo [+] Docker is running

REM Start Docker Compose services
echo [*] Starting WordPress and MySQL...
call docker compose down -v 2>nul
call docker compose up -d

echo [*] Waiting for WordPress to initialize (approximately 40 seconds)...
timeout /t 40 /nobreak

REM Wait for WordPress to be responsive
:wait_wordpress
curl -s %TEST_URL%/ -o nul 2>&1
if errorlevel 1 (
    echo [*] WordPress not responding, waiting...
    timeout /t 5 /nobreak
    goto wait_wordpress
)

echo [+] WordPress is responding

echo.
echo ======================================
echo Setup Complete!
echo ======================================
echo.
echo WordPress is ready at: %TEST_URL%
echo Admin URL: %TEST_URL%/wp-admin
echo Admin User: admin
echo Admin Password: password
echo.
echo Next steps:
echo   1. Install dependencies: npm ci
echo   2. Build assets: npm run build
echo   3. Install Playwright: npx playwright install chromium
echo   4. Run tests:
echo      - npm run test:screenshots
echo      - Or use: npm run quick:test
echo.
echo To stop services: docker compose down
echo To reset data: docker compose down -v

