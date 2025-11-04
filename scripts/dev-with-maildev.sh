#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
  echo -e "\n${YELLOW}Shutting down MailDev...${NC}"
  docker-compose -f docker-compose.maildev.yml down > /dev/null 2>&1
  exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup SIGINT SIGTERM

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi

# Check if MailDev container is already running
if docker ps --format '{{.Names}}' | grep -q "^finwise-maildev$"; then
  echo -e "${GREEN}✓ MailDev is already running${NC}"
else
  echo -e "${YELLOW}Starting MailDev...${NC}"
  docker-compose -f docker-compose.maildev.yml up -d
  
  # Wait a moment for MailDev to be ready
  sleep 2
  
  if docker ps --format '{{.Names}}' | grep -q "^finwise-maildev$"; then
    echo -e "${GREEN}✓ MailDev started successfully${NC}"
    echo -e "${GREEN}  SMTP: localhost:1025${NC}"
    echo -e "${GREEN}  Web UI: http://localhost:1080${NC}"
  else
    echo -e "${RED}❌ Failed to start MailDev${NC}"
    exit 1
  fi
fi

# Start the development server
echo -e "${GREEN}Starting development server...${NC}"
echo ""
nodemon --watch src --exec ts-node src/server.ts

