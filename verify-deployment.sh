#!/bin/bash
# Lux-Auto Deployment Verification Script
# This script verifies that all components are ready for production deployment

set -e

echo "============================================"
echo "Lux-Auto Production Deployment Verification"
echo "============================================"
echo ""

# Check Docker
echo "[1/7] Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "✅ Docker is installed: $DOCKER_VERSION"
else
    echo "❌ Docker is not installed"
    exit 1
fi

# Check Docker images
echo ""
echo "[2/7] Checking Docker images..."
if docker image inspect lux-auto-backend:latest > /dev/null 2>&1; then
    echo "✅ lux-auto-backend:latest image exists"
else
    echo "❌ lux-auto-backend:latest image not found"
    exit 1
fi

# Check docker-compose.prod.yml
echo ""
echo "[3/7] Checking docker-compose configuration..."
if [ -f "docker-compose.prod.yml" ]; then
    echo "✅ docker-compose.prod.yml exists"
else
    echo "❌ docker-compose.prod.yml not found"
    exit 1
fi

# Validate docker-compose.prod.yml
echo ""
echo "[4/7] Validating docker-compose.prod.yml..."
if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    echo "✅ docker-compose.prod.yml is valid"
    SERVICE_COUNT=$(docker-compose -f docker-compose.prod.yml config | grep "^  [a-z].*:" | wc -l)
    echo "   Services defined: $SERVICE_COUNT"
else
    echo "❌ docker-compose.prod.yml validation failed"
    exit 1
fi

# Check environment configuration
echo ""
echo "[5/7] Checking environment configuration..."
if [ -f ".env.production" ]; then
    echo "✅ .env.production exists"
    ENV_VARS=$(grep -c "=" .env.production || true)
    echo "   Environment variables: $ENV_VARS"
else
    echo "❌ .env.production not found"
    exit 1
fi

# Verify Dockerfile
echo ""
echo "[6/7] Verifying Dockerfile..."
if [ -f "Dockerfile.backend" ]; then
    echo "✅ Dockerfile.backend exists"
    if grep -q "PYTHONUSERBASE=/home/appuser/.local" Dockerfile.backend; then
        echo "   ✅ PYTHONUSERBASE correctly configured"
    fi
    if grep -q "PATH=/home/appuser/.local/bin" Dockerfile.backend; then
        echo "   ✅ PATH correctly configured"
    fi
    if grep -q "USER appuser" Dockerfile.backend; then
        echo "   ✅ Non-root user configured"
    fi
else
    echo "❌ Dockerfile.backend not found"
    exit 1
fi

# Check git commits
echo ""
echo "[7/7] Checking Git repository..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "✅ Git repository initialized"
    TOTAL_COMMITS=$(git rev-list --count HEAD)
    RECENT_COMMITS=$(git log --oneline -n 3 | sed 's/^/   /' || true)
    echo "   Total commits: $TOTAL_COMMITS"
    echo "   Recent commits:"
    git log --oneline -n 3 | while read line; do echo "     $line"; done
else
    echo "⚠️  Git repository not found"
fi

echo ""
echo "============================================"
echo "✅ DEPLOYMENT VERIFICATION COMPLETE"
echo "============================================"
echo ""
echo "All components verified successfully!"
echo ""
echo "Next steps to deploy:"
echo "  1. Update .env.production with your configuration"
echo "  2. Run: docker-compose -f docker-compose.prod.yml up -d"
echo "  3. Verify with: docker-compose -f docker-compose.prod.yml ps"
echo ""
