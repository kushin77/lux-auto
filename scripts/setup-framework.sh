#!/bin/bash
# Enterprise Standards Framework - Complete Setup Script
# This script automates Phase 2 (local setup) and Phase 3 (GitHub setup)
# Run this after cloning the repository

set -e  # Exit on any error

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  Lux-Auto Enterprise Standards Framework - Setup Automation        ║"
echo "║  Phase 2: Local Developer Environment                             ║"
echo "║  Phase 3: GitHub Configuration                                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Phase 2: Local Development Setup
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "PHASE 2: LOCAL DEVELOPMENT ENVIRONMENT SETUP"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Check Python version
print_step "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 not found. Please install Python 3.11 or higher"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
print_success "Python $PYTHON_VERSION found"

# Create virtual environment
print_step "Creating Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_success "Virtual environment created"
else
    print_warning "Virtual environment already exists"
fi

# Activate virtual environment
print_step "Activating virtual environment..."
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
print_success "Virtual environment activated"

# Upgrade pip
print_step "Upgrading pip..."
pip install --upgrade pip setuptools wheel > /dev/null 2>&1
print_success "pip upgraded"

# Install dependencies
print_step "Installing backend dependencies..."
if [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt > /dev/null 2>&1
    print_success "Backend dependencies installed"
else
    print_error "backend/requirements.txt not found"
    exit 1
fi

# Install development tools
print_step "Installing development tools..."
DEV_DEPS="black ruff pylint mypy pytest pytest-asyncio pytest-cov bandit pre-commit"
pip install $DEV_DEPS > /dev/null 2>&1
print_success "Development tools installed"

# Install pre-commit hooks
print_step "Installing pre-commit hooks..."
if [ -f ".pre-commit-config.yaml" ]; then
    pre-commit install > /dev/null 2>&1
    print_success "Pre-commit hooks installed"
    print_warning "Hooks will run on 'git commit' - this is expected!"
else
    print_error ".pre-commit-config.yaml not found"
fi

# Verify local setup
echo ""
print_step "Verifying local setup..."

# Test Black
if python3 -c "import black" &> /dev/null; then
    print_success "Black (code formatter) is available"
else
    print_error "Black not found"
fi

# Test MyPy
if python3 -c "import mypy" &> /dev/null; then
    print_success "MyPy (type checker) is available"
else
    print_error "MyPy not found"
fi

# Test Pytest
if python3 -c "import pytest" &> /dev/null; then
    print_success "Pytest (test runner) is available"
else
    print_error "Pytest not found"
fi

# Test Bandit
if command -v bandit &> /dev/null; then
    print_success "Bandit (SAST scanner) is available"
else
    print_error "Bandit not found"
fi

echo ""
echo -e "${GREEN}✓ Phase 2 (Local Setup) Complete!${NC}"
echo ""

# Phase 3: GitHub Configuration (requires GitHub CLI and admin access)
echo "═══════════════════════════════════════════════════════════════════"
echo "PHASE 3: GITHUB CONFIGURATION (Optional - Admin Only)"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Check if GitHub CLI is available
if ! command -v gh &> /dev/null; then
    print_warning "GitHub CLI (gh) not found. Skipping automated GitHub setup."
    print_warning "Manual setup required: See docs/GITHUB-BRANCH-PROTECTION.md"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
else
    print_success "GitHub CLI found"
    
    # Check authentication
    print_step "Checking GitHub authentication..."
    if gh auth status > /dev/null 2>&1; then
        print_success "GitHub CLI authenticated"
        
        # Get repo name
        read -p "Enter GitHub repository (format: owner/repo): " repo_name
        
        if [ -z "$repo_name" ]; then
            print_error "Repository name required"
            exit 1
        fi
        
        # Enable branch protection for main branch
        print_step "Setting up branch protection for 'main' branch..."
        if gh api repos/$repo_name/branches/main/protection \
            --input /dev/stdin << 'EOF' > /dev/null 2>&1; then
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "lint",
      "type-check",
      "tests",
      "security (bandit)",
      "dependency-scan",
      "secrets-scan",
      "integration-tests"
    ]
  },
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 2
  },
  "enforce_admins": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "require_conversation_resolution": true
}
EOF
            print_success "Branch protection configured"
        else
            print_warning "Could not set branch protection via API. Use GitHub UI: Settings → Branches → main"
        fi
    else
        print_warning "GitHub CLI not authenticated. Run: gh auth login"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "SETUP COMPLETE!"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Next Steps:"
echo "  1. Read CONTRIBUTING.md to understand standards"
echo "  2. Read DEVELOPER-QUICKSTART.md for first PR workflow"
echo "  3. Create a feature branch: git checkout -b feature/your-feature"
echo "  4. Make changes and commit (pre-commit checks will run)"
echo "  5. Submit PR with complete template"
echo ""
echo "For team training, see: TEAM-TRAINING.md"
echo "For architecture decisions, see: docs/adr/README.md"
echo "For incident response, see: docs/runbooks/README.md"
echo ""
print_success "Framework ready. Start contributing!"
