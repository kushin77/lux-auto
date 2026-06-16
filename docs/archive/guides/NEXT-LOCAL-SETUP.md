# NEXT TASK: Local Environment Setup & Testing

**Status:** Ready to Execute

---

## What to Do Next

### 1. Install Python Environment
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or on Windows:
venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
pip install pre-commit
```

### 2. Setup Pre-commit Hooks
```bash
pre-commit install
pre-commit run --all-files  # Test all files
```

### 3. Run Tests Locally
```bash
cd backend
pytest -v --cov=. tests/
```

### 4. Run Security Checks
```bash
# SAST security
bandit -r backend/ -f json > bandit-report.json

# Dependency check
pip-audit

# Secrets scan
truffleHog filesystem .
```

### 5. Build Docker Image
```bash
docker build -f Dockerfile.backend -t lux-auto:latest .
docker scan lux-auto:latest  # Container vulnerability scan
```

### 6. Submit Test PR (Verify Pipeline)
```bash
git checkout -b test/ci-pipeline-verification
echo "# Test PR" >> TEST.md
git add TEST.md
git commit -m "test: CI pipeline verification"
git push origin test/ci-pipeline-verification
# Create PR on GitHub - watch 9-stage pipeline run
```

---

## CI/CD Pipeline Stages (Automatic on PR)

1. **Lint** - Code formatting (Black, Pylint)
2. **Type Check** - Type hints (Pyright)
3. **Unit Tests** - pytest (90%+ coverage required)
4. **SAST** - Security code analysis (Bandit)
5. **Secrets** - Hardcoded secrets check (truffleHog)
6. **Dependencies** - Vulnerable packages (Safety)
7. **Integration** - Full stack tests
8. **Docker Build** - Container image creation
9. **Container Scan** - Image vulnerabilities (Trivy)

---

## Success Criteria

- [ ] Python environment created
- [ ] Dependencies installed
- [ ] Pre-commit hooks working
- [ ] All tests pass locally
- [ ] Security scans pass
- [ ] Docker image builds
- [ ] Test PR passes 9-stage pipeline
- [ ] Ready for production deployment

---

## Estimated Time: 1-2 hours

After setup is complete, code is deployment-ready.
