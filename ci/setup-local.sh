#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}TestTag Screenshot Testing - Setup${NC}"
echo "======================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}✗ Docker is not running. Please start Docker first.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Start Docker Compose services
echo -e "${YELLOW}Starting WordPress and MySQL...${NC}"
docker-compose up -d

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Check if WordPress is responding
max_attempts=30
attempt=1
until curl -f http://localhost:8080/ > /dev/null 2>&1; do
  if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}✗ WordPress did not start in time${NC}"
    docker-compose logs wordpress
    exit 1
  fi
  echo "Waiting for WordPress... (attempt $attempt/$max_attempts)"
  sleep 2
  ((attempt++))
done

echo -e "${GREEN}✓ WordPress is responding${NC}"

# Get WordPress container ID
WP_CONTAINER=$(docker-compose ps -q wordpress)

if [ -z "$WP_CONTAINER" ]; then
  echo -e "${RED}✗ Could not find WordPress container${NC}"
  exit 1
fi

# Install WordPress core
echo -e "${YELLOW}Installing WordPress core...${NC}"
docker exec "$WP_CONTAINER" wp core install \
  --url=http://localhost:8080 \
  --title="TestTag Screenshot Tests" \
  --admin_user=admin \
  --admin_password=password \
  --admin_email=admin@example.local \
  --allow-root 2>/dev/null || echo "WordPress already installed"

echo -e "${GREEN}✓ WordPress core installed${NC}"

# Create test user
echo -e "${YELLOW}Creating test user...${NC}"
docker exec "$WP_CONTAINER" wp user create \
  testuser \
  test@example.local \
  --user_pass=testpass123 \
  --role=editor \
  --allow-root 2>/dev/null || echo "Test user already exists"

echo -e "${GREEN}✓ Test user created${NC}"

# Update WordPress options
echo -e "${YELLOW}Updating WordPress configuration...${NC}"
docker exec "$WP_CONTAINER" wp option update home http://localhost:8080 --allow-root
docker exec "$WP_CONTAINER" wp option update siteurl http://localhost:8080 --allow-root

echo -e "${GREEN}✓ WordPress configured${NC}"

# Activate TestTag plugin
echo -e "${YELLOW}Activating TestTag plugin...${NC}"
docker exec "$WP_CONTAINER" wp plugin activate testtag-for-wordpress --allow-root 2>/dev/null || echo "Plugin may already be active"

echo -e "${GREEN}✓ TestTag plugin activated${NC}"

# Configure TestTag
echo -e "${YELLOW}Configuring TestTag settings...${NC}"
docker exec "$WP_CONTAINER" wp option update testtag_attribute_key data-testid --allow-root
docker exec "$WP_CONTAINER" wp option update testtag_environment_guard 0 --allow-root
docker exec "$WP_CONTAINER" wp option update testtag_force_enable 1 --allow-root

echo -e "${GREEN}✓ TestTag configured${NC}"

echo ""
echo -e "${GREEN}======================================"
echo "Setup Complete!"
echo "=====================================${NC}"
echo ""
echo "WordPress is ready at: http://localhost:8080"
echo "Admin URL: http://localhost:8080/wp-admin"
echo "Admin User: admin"
echo "Admin Password: password"
echo ""
echo "Next steps:"
echo "  1. Install dependencies: npm ci"
echo "  2. Build assets: npm run build"
echo "  3. Install Playwright: npx playwright install chromium"
echo "  4. Run tests:"
echo "     - Interactive: npm run test:screenshots:ui"
echo "     - Headed: npm run test:screenshots:headed"
echo "     - Headless: npm run test:screenshots"
echo ""
echo "To stop services: docker-compose down"
echo "To reset data: docker-compose down -v"
