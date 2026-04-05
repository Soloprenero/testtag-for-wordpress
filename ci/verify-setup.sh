#!/bin/bash
# Verification script to check if screenshot testing is properly set up

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   TestTag Screenshot Testing - Setup Verification         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Check 1: Node.js and npm
echo -e "${YELLOW}[1/10]${NC} Checking Node.js and npm..."
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo -e "${GREEN}✓ Node.js found: $NODE_VERSION${NC}"
else
  echo -e "${RED}✗ Node.js not found${NC}"
  ((ERRORS++))
fi

if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm --version)
  echo -e "${GREEN}✓ npm found: $NPM_VERSION${NC}"
else
  echo -e "${RED}✗ npm not found${NC}"
  ((ERRORS++))
fi

# Check 2: Docker
echo ""
echo -e "${YELLOW}[2/10]${NC} Checking Docker..."
if command -v docker &> /dev/null; then
  echo -e "${GREEN}✓ Docker found${NC}"
  if docker info &> /dev/null; then
    echo -e "${GREEN}✓ Docker daemon is running${NC}"
  else
    echo -e "${YELLOW}⚠ Docker daemon is not running${NC}"
    ((WARNINGS++))
  fi
else
  echo -e "${RED}✗ Docker not found${NC}"
  ((ERRORS++))
fi

# Check 3: Docker Compose
echo ""
echo -e "${YELLOW}[3/10]${NC} Checking Docker Compose..."
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
  echo -e "${GREEN}✓ Docker Compose found${NC}"
else
  echo -e "${RED}✗ Docker Compose not found${NC}"
  ((ERRORS++))
fi

# Check 4: Required files
echo ""
echo -e "${YELLOW}[4/10]${NC} Checking required files..."

FILES=(
  "playwright.config.js"
  "docker-compose.yml"
  "tests/e2e/screenshots.spec.js"
  "tests/helpers/wordpress.js"
  "tests/global-setup.js"
  ".github/workflows/screenshots.yml"
  "SCREENSHOT_TESTING.md"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓ $file${NC}"
  else
    echo -e "${RED}✗ $file missing${NC}"
    ((ERRORS++))
  fi
done

# Check 5: package.json scripts
echo ""
echo -e "${YELLOW}[5/10]${NC} Checking package.json scripts..."
if grep -q '"test:screenshots"' package.json; then
  echo -e "${GREEN}✓ test:screenshots script found${NC}"
else
  echo -e "${RED}✗ test:screenshots script not found${NC}"
  ((ERRORS++))
fi

if grep -q '"test:screenshots:ui"' package.json; then
  echo -e "${GREEN}✓ test:screenshots:ui script found${NC}"
else
  echo -e "${RED}✗ test:screenshots:ui script not found${NC}"
  ((ERRORS++))
fi

# Check 6: Playwright in package.json
echo ""
echo -e "${YELLOW}[6/10]${NC} Checking Playwright dependency..."
if grep -q '"@playwright/test"' package.json; then
  echo -e "${GREEN}✓ @playwright/test in devDependencies${NC}"
else
  echo -e "${RED}✗ @playwright/test not in devDependencies${NC}"
  ((ERRORS++))
fi

# Check 7: node_modules presence (recommend but not required)
echo ""
echo -e "${YELLOW}[7/10]${NC} Checking node_modules..."
if [ -d "node_modules" ]; then
  if [ -d "node_modules/@playwright" ]; then
    echo -e "${GREEN}✓ node_modules with Playwright found${NC}"
  else
    echo -e "${YELLOW}⚠ node_modules found but Playwright not installed${NC}"
    ((WARNINGS++))
  fi
else
  echo -e "${YELLOW}⚠ node_modules not found (run 'npm ci')${NC}"
  ((WARNINGS++))
fi

# Check 8: WordPress connectivity (if Docker running)
echo ""
echo -e "${YELLOW}[8/10]${NC} Testing WordPress connectivity..."
if docker info &> /dev/null; then
  WP_CONTAINER=$(docker-compose ps -q wordpress 2>/dev/null || echo "")
  if [ -n "$WP_CONTAINER" ]; then
    if curl -s http://localhost:8080/ > /dev/null; then
      echo -e "${GREEN}✓ WordPress is accessible at http://localhost:8080${NC}"
    else
      echo -e "${YELLOW}⚠ WordPress not responding (container may not be running)${NC}"
      ((WARNINGS++))
    fi
  else
    echo -e "${YELLOW}⚠ WordPress container not running (start with: docker-compose up -d)${NC}"
    ((WARNINGS++))
  fi
else
  echo -e "${YELLOW}⚠ Docker not running, skipping WordPress check${NC}"
  ((WARNINGS++))
fi

# Check 9: .gitignore updated
echo ""
echo -e "${YELLOW}[9/10]${NC} Checking .gitignore..."
if grep -q "tests/screenshots" .gitignore; then
  echo -e "${GREEN}✓ Screenshot ignore rules found${NC}"
else
  echo -e "${YELLOW}⚠ Screenshot ignore rules not found (recommended)${NC}"
  ((WARNINGS++))
fi

# Check 10: Setup scripts
echo ""
echo -e "${YELLOW}[10/10]${NC} Checking setup scripts..."
if [ -f "ci/setup-local.sh" ] && [ -f "ci/setup-local.bat" ]; then
  echo -e "${GREEN}✓ Setup scripts found (Unix and Windows)${NC}"
else
  echo -e "${YELLOW}⚠ Setup scripts missing${NC}"
  ((WARNINGS++))
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                         SUMMARY                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed! Setup is complete.${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. npm ci                       (install dependencies)"
  echo "  2. npm run build                (build plugin assets)"
  echo "  3. docker-compose up -d         (start WordPress)"
  echo "  4. npx playwright install       (install browsers)"
  echo "  5. npm run test:screenshots     (run tests)"
  echo ""
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}✓ Setup is mostly complete, but check warnings above${NC}"
  echo "Warnings: $WARNINGS"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Setup incomplete. Please fix errors above.${NC}"
  echo "Errors: $ERRORS"
  echo "Warnings: $WARNINGS"
  echo ""
  echo "Suggested steps:"
  echo "  1. Verify Docker is installed: https://docs.docker.com/get-docker/"
  echo "  2. Run: npm ci"
  echo "  3. See SCREENSHOT_TESTING.md for detailed setup"
  echo ""
  exit 1
fi
