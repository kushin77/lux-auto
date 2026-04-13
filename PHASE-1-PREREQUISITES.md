# 🔧 PHASE 1: PREREQUISITES SETUP & VERIFICATION

**Status:** Some tools may need environment setup  
**Action:** Follow steps below to verify & prepare environment

---

## Prerequisites Checklist

### 1. Docker Desktop ✅
- You have Docker running (visible in Docker Dashboard)
- Required: Docker 20.10+
- Status: **READY** (we saw 6 containers running)

### 2. PostgreSQL Connection
**Need to verify:** Can connect to `lux.kushnir.cloud:5432`

```powershell
# If psql not in PATH, find it:
# Windows: Check if PostgreSQL installed in Program Files
$env:PATH -split ";" | Select-String "postgres"

# Or connect directly from Docker:
docker exec -it ollama-init psql -U postgres -h lux.kushnir.cloud -c "SELECT 1"

# Or use: C:\Program Files\PostgreSQL\15\bin\psql.exe
# (adjust version number to your installation)
```

### 3. Redis Connection
**Need to verify:** Can connect to `lux.kushnir.cloud:6379`

```powershell
# If redis-cli not in PATH:
# Docker approach:
docker run --rm redis:latest redis-cli -h lux.kushnir.cloud ping

# Or from local Redis installation:
# C:\Program Files\Redis\redis-cli.exe -h lux.kushnir.cloud ping
```

---

## Quick Setup (If Tools Missing)

### Option A: Use Docker Inside Docker (Recommended)

```powershell
# Test PostgreSQL via Docker
docker run --rm postgres:15 psql -U postgres -h lux.kushnir.cloud -c "SELECT version();"

# Test Redis via Docker
docker run --rm redis:latest redis-cli -h lux.kushnir.cloud ping
```

### Option B: Install Missing Tools

**PostgreSQL Client:**
```powershell
# Chocolatey (if installed)
choco install postgresql

# Or download from: https://www.postgresql.org/download/windows/
```

**Redis CLI:**
```powershell
# Chocolatey
choco install redis-64

# Or: https://github.com/microsoftarchive/redis/releases
```

---

## What We Know is Ready ✅

From your Docker Desktop screenshot:
- ✅ Docker Desktop running
- ✅ 6 services active (code-server, ollama, oauth2, caddy, etc)
- ✅ Ports available for our deployment (8888-8891)
- ✅ CPU & Memory available

---

## PHASE 1 VERIFICATION (Do This)

**Test using Docker (no local tools needed):**

```powershell
cd "C:\Users\Alex Kushnir\Desktop\Lux-auto"

# 1. Verify Docker works
docker --version

# 2. List existing containers
docker ps

# 3. Test PostgreSQL connection
docker run --rm postgres:15 psql -U postgres -h lux.kushnir.cloud -c "SELECT version();" 

# If successful: Shows database version
# If fails: PostgreSQL not accessible on that domain/host

# 4. Test Redis connection
docker run --rm redis:latest redis-cli -h lux.kushnir.cloud ping

# If successful: Returns PONG
# If fails: Redis not accessible on that domain/host
```

---

## NEXT: Phase 2 - Build Docker Image

Once Phase 1 passes, build the image:

```powershell
cd "C:\Users\Alex Kushnir\Desktop\Lux-auto"

docker build -f Dockerfile.backend -t lux-auto:latest .
```

**Expected output:**
```
Step 1/X FROM python:3.10
...
Successfully built abc123def456
Successfully tagged lux-auto:latest
```

**Estimated time:** 10 minutes

---

## Troubleshooting

### PostgreSQL Connection Fails
- Verify `lux.kushnir.cloud` resolves: `nslookup lux.kushnir.cloud`
- Verify PostgreSQL running on host
- Check firewall rules
- Try direct IP instead of domain

### Redis Connection Fails
- Verify `lux.kushnir.cloud` resolves: `nslookup lux.kushnir.cloud`
- Verify Redis running on host
- Check port 6379 accessible
- Check firewall rules

### Docker Build Fails
- Verify Docker Desktop is running: `docker ps`
- Check disk space: `docker system df`
- Clear cache: `docker system prune`
- Check Dockerfile.backend exists: `ls Dockerfile.backend`

---

## READY TO PROCEED?

When Phase 1 passes:
1. Run Phase 2: Build Docker image
2. Follow DOCKER-DESKTOP-DEPLOYMENT.md Phases 3-6
3. Deployment to production in ~50 minutes total

**Start by running the Docker connection tests above.** ⬆️
