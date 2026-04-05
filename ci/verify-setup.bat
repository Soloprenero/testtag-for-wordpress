@echo off
REM Verification script to check if screenshot testing is properly set up (Windows)

setlocal enabledelayedexpansion

echo.
echo ======================================
echo   TestTag Screenshot Testing Setup
echo   Verification (Windows)
echo ======================================
echo.

set "ERRORS=0"
set "WARNINGS=0"

REM Check 1: Node.js and npm
echo [1/9] Checking Node.js and npm...
where node >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo [+] Node.js found: !NODE_VERSION!
) else (
    echo [-] Node.js not found
    set /a ERRORS+=1
)

where npm >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo [+] npm found: !NPM_VERSION!
) else (
    echo [-] npm not found
    set /a ERRORS+=1
)

REM Check 2: Docker
echo.
echo [2/9] Checking Docker...
docker --version >nul 2>&1
if !errorlevel! equ 0 (
    echo [+] Docker found
    docker info >nul 2>&1
    if !errorlevel! equ 0 (
        echo [+] Docker daemon is running
    ) else (
        echo [!] Docker daemon is not running
        set /a WARNINGS+=1
    )
) else (
    echo [-] Docker not found
    set /a ERRORS+=1
)

REM Check 3: Docker Compose
echo.
echo [3/9] Checking Docker Compose...
docker-compose --version >nul 2>&1
if !errorlevel! equ 0 (
    echo [+] Docker Compose found
) else (
    docker compose version >nul 2>&1
    if !errorlevel! equ 0 (
        echo [+] Docker Compose found (via 'docker compose')
    ) else (
        echo [-] Docker Compose not found
        set /a ERRORS+=1
    )
)

REM Check 4: Required files
echo.
echo [4/9] Checking required files...

for %%F in (
    "playwright.config.js"
    "docker-compose.yml"
    "tests\e2e\screenshots.spec.js"
    "tests\helpers\wordpress.js"
    "tests\global-setup.js"
    ".github\workflows\screenshots.yml"
    "SCREENSHOT_TESTING.md"
) do (
    if exist "%%F" (
        echo [+] %%F
    ) else (
        echo [-] %%F missing
        set /a ERRORS+=1
    )
)

REM Check 5: package.json scripts
echo.
echo [5/9] Checking package.json scripts...
findstr /c:"test:screenshots" package.json >nul 2>&1
if !errorlevel! equ 0 (
    echo [+] test:screenshots script found
) else (
    echo [-] test:screenshots script not found
    set /a ERRORS+=1
)

findstr /c:"test:screenshots:ui" package.json >nul 2>&1
if !errorlevel! equ 0 (
    echo [+] test:screenshots:ui script found
) else (
    echo [-] test:screenshots:ui script not found
    set /a ERRORS+=1
)

REM Check 6: Playwright in package.json
echo.
echo [6/9] Checking Playwright dependency...
findstr /c:"@playwright/test" package.json >nul 2>&1
if !errorlevel! equ 0 (
    echo [+] @playwright/test in devDependencies
) else (
    echo [-] @playwright/test not in devDependencies
    set /a ERRORS+=1
)

REM Check 7: node_modules presence
echo.
echo [7/9] Checking node_modules...
if exist "node_modules" (
    if exist "node_modules\@playwright" (
        echo [+] node_modules with Playwright found
    ) else (
        echo [!] node_modules found but Playwright not installed
        set /a WARNINGS+=1
    )
) else (
    echo [!] node_modules not found (run 'npm ci')
    set /a WARNINGS+=1
)

REM Check 8: .gitignore updated
echo.
echo [8/9] Checking .gitignore...
findstr /c:"tests/screenshots" .gitignore >nul 2>&1
if !errorlevel! equ 0 (
    echo [+] Screenshot ignore rules found
) else (
    echo [!] Screenshot ignore rules not found
    set /a WARNINGS+=1
)

REM Check 9: Setup scripts
echo.
echo [9/9] Checking setup scripts...
if exist "ci\setup-local.bat" (
    echo [+] Windows setup script found
) else (
    echo [!] Windows setup script missing
    set /a WARNINGS+=1
)

if exist "ci\setup-local.sh" (
    echo [+] Unix setup script found
) else (
    echo [!] Unix setup script missing
    set /a WARNINGS+=1
)

REM Summary
echo.
echo ======================================
echo              SUMMARY
echo ======================================
echo.

if !ERRORS! equ 0 (
    if !WARNINGS! equ 0 (
        echo [+] All checks passed! Setup is complete.
        echo.
        echo Next steps:
        echo   1. npm ci                       (install dependencies^)
        echo   2. npm run build                (build plugin assets^)
        echo   3. docker-compose up -d         (start WordPress^)
        echo   4. npx playwright install       (install browsers^)
        echo   5. npm run test:screenshots     (run tests^)
        echo.
        exit /b 0
    ) else (
        echo [+] Setup is mostly complete, but check warnings above
        echo Warnings: !WARNINGS!
        echo.
        exit /b 0
    )
) else (
    echo [-] Setup incomplete. Please fix errors above.
    echo Errors: !ERRORS!
    echo Warnings: !WARNINGS!
    echo.
    echo Suggested steps:
    echo   1. Verify Docker is installed: https://docs.docker.com/get-docker/
    echo   2. Run: npm ci
    echo   3. See SCREENSHOT_TESTING.md for detailed setup
    echo.
    exit /b 1
)
