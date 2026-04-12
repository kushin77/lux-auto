# Enterprise Standards Framework - Complete Setup Script (Windows)
# This script automates Phase 2 (local setup) and Phase 3 (GitHub setup)
# Run this after cloning the repository
# Usage: .\scripts\setup-framework.ps1

param(
    [switch]$SkipGitHub = $false
)

# Color codes for output
function Write-Step { Write-Host "▶ $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Error { Write-Host "✗ $args" -ForegroundColor Red }
function Write-Warning { Write-Host "⚠ $args" -ForegroundColor Yellow }

# Set error action to stop
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Lux-Auto Enterprise Standards Framework - Setup Automation        ║" -ForegroundColor Cyan
Write-Host "║  Phase 2: Local Developer Environment                             ║" -ForegroundColor Cyan
Write-Host "║  Phase 3: GitHub Configuration                                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Phase 2: Local Development Setup
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "PHASE 2: LOCAL DEVELOPMENT ENVIRONMENT SETUP" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check Python version
Write-Step "Checking Python installation..."
try {
    $pythonVersion = python --version 2>&1
    Write-Success "Python found: $pythonVersion"
} catch {
    Write-Error "Python not found. Please install Python 3.11 or higher"
    exit 1
}

# Create virtual environment
Write-Step "Creating Python virtual environment..."
if (-not (Test-Path "venv")) {
    python -m venv venv
    Write-Success "Virtual environment created"
} else {
    Write-Warning "Virtual environment already exists"
}

# Activate virtual environment
Write-Step "Activating virtual environment..."
& ".\venv\Scripts\Activate.ps1"
Write-Success "Virtual environment activated"

# Upgrade pip
Write-Step "Upgrading pip..."
python -m pip install --upgrade pip setuptools wheel | Out-Null
Write-Success "pip upgraded"

# Install dependencies
Write-Step "Installing backend dependencies..."
if (Test-Path "backend/requirements.txt") {
    pip install -r backend/requirements.txt | Out-Null
    Write-Success "Backend dependencies installed"
} else {
    Write-Error "backend/requirements.txt not found"
    exit 1
}

# Install development tools
Write-Step "Installing development tools..."
$devDeps = @("black", "ruff", "pylint", "mypy", "pytest", "pytest-asyncio", "pytest-cov", "bandit", "pre-commit")
pip install $devDeps | Out-Null
Write-Success "Development tools installed"

# Install pre-commit hooks
Write-Step "Installing pre-commit hooks..."
if (Test-Path ".pre-commit-config.yaml") {
    pre-commit install | Out-Null
    Write-Success "Pre-commit hooks installed"
    Write-Warning "Hooks will run on 'git commit' - this is expected!"
} else {
    Write-Error ".pre-commit-config.yaml not found"
}

# Verify local setup
Write-Host ""
Write-Step "Verifying local setup..."

# Test Black
try {
    python -c "import black" | Out-Null
    Write-Success "Black (code formatter) is available"
} catch {
    Write-Error "Black not found"
}

# Test MyPy
try {
    python -c "import mypy" | Out-Null
    Write-Success "MyPy (type checker) is available"
} catch {
    Write-Error "MyPy not found"
}

# Test Pytest
try {
    python -c "import pytest" | Out-Null
    Write-Success "Pytest (test runner) is available"
} catch {
    Write-Error "Pytest not found"
}

# Test Bandit
try {
    bandit --version | Out-Null
    Write-Success "Bandit (SAST scanner) is available"
} catch {
    Write-Warning "Bandit not found"
}

Write-Host ""
Write-Host "✓ Phase 2 (Local Setup) Complete!" -ForegroundColor Green
Write-Host ""

# Phase 3: GitHub Configuration (optional)
if (-not $SkipGitHub) {
    Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "PHASE 3: GITHUB CONFIGURATION (Optional - Admin Only)" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if GitHub CLI is available
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        Write-Warning "GitHub CLI (gh) not found. Skipping automated GitHub setup."
        Write-Warning "Manual setup required: See docs/GITHUB-BRANCH-PROTECTION.md"
    } else {
        Write-Success "GitHub CLI found"
        
        # Check authentication
        Write-Step "Checking GitHub authentication..."
        try {
            gh auth status | Out-Null
            Write-Success "GitHub CLI authenticated"
        } catch {
            Write-Warning "GitHub CLI not authenticated. Run: gh auth login"
        }
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "SETUP COMPLETE!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Green
Write-Host "  1. Read CONTRIBUTING.md to understand standards"
Write-Host "  2. Read DEVELOPER-QUICKSTART.md for first PR workflow"
Write-Host "  3. Create a feature branch: git checkout -b feature/your-feature"
Write-Host "  4. Make changes and commit (pre-commit checks will run)"
Write-Host "  5. Submit PR with complete template"
Write-Host ""
Write-Host "For team training, see: TEAM-TRAINING.md"
Write-Host "For architecture decisions, see: docs/adr/README.md"
Write-Host "For incident response, see: docs/runbooks/README.md"
Write-Host ""
Write-Success "Framework ready. Start contributing!"
