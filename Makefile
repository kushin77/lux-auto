# ─────────────────────────────────────────────────────────────────────────────
# Lux Auto — unified CLI.  Run `make help` to see all commands.
# ─────────────────────────────────────────────────────────────────────────────
.DEFAULT_GOAL := help
.PHONY: help \
  setup login pull push watch deploy open logs lint fix verify clean \
  mh-token mh-mmr mh-search \
  backend-install backend-test backend-test-cov backend-run backend-deploy \
  gcp-setup secrets-show \
  webapp-bootstrap webapp-deploy \
  pr ci-status

# ── GCP / deployment settings (override via env or CLI) ──────────────────────
PROJECT_ID ?= lux-auto
REGION     ?= us-central1
SERVICE    ?= lux-auto-api
GITHUB_REPO ?= kushin77/lux-auto

# ─────────────────────────────────────────────────────────────────────────────
# HELP
# ─────────────────────────────────────────────────────────────────────────────

help: ## Show this help
	@echo ""
	@echo "  Lux Auto CLI"
	@echo "  ────────────────────────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS=":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ─────────────────────────────────────────────────────────────────────────────
# APPS SCRIPT (root-level clasp — the GAS source files)
# ─────────────────────────────────────────────────────────────────────────────

setup: ## Install dev deps (clasp, eslint) and copy .env
	npm install
	@test -f .env || cp .env.example .env
	@echo "→ Edit .env, then run: make login"

login: ## Authenticate clasp with your Google account
	npx clasp login

pull: ## Pull live Apps Script source into local files
	npx clasp pull

push: ## Push local .gs/.html to Apps Script (one-shot)
	npx clasp push

watch: ## Auto-push on every save (live dev loop)
	npx clasp push --watch

deploy: ## Push + create a new versioned web-app deployment
	npx clasp push --force && npx clasp deploy

open: ## Open the script editor in the browser
	npx clasp open

logs: ## Tail Stackdriver execution logs
	npx clasp logs --watch

lint: ## Lint all .gs and Node CLI files
	npm run lint

fix: ## Auto-fix lint issues
	npm run lint:fix

verify: ## Lint + syntax-check the toolchain
	npm run verify

clean: ## Remove node_modules and local build artifacts
	rm -rf node_modules

# ─────────────────────────────────────────────────────────────────────────────
# MANHEIM CLI  (tools/manheim.mjs)
# ─────────────────────────────────────────────────────────────────────────────

mh-token: ## Test Manheim auth — fetch + print token summary
	npm run mh -- token

mh-mmr: ## MMR lookup by VIN:  make mh-mmr VIN=ZFF79ALA4J0231234
	npm run mh -- mmr $(VIN)

mh-search: ## Listings search:  make mh-search Q="Ferrari"
	npm run mh -- search "$(Q)"

# ─────────────────────────────────────────────────────────────────────────────
# BACKEND  (FastAPI, Python)
# ─────────────────────────────────────────────────────────────────────────────

backend-install: ## Install Python deps (runtime + dev)
	pip install -r backend/requirements.txt -r backend/requirements-dev.txt

backend-test: ## Run smoke + integration tests
	pytest backend/tests/ -v --tb=short \
	  -e DATABASE_URL="sqlite:///./_smoke_test.db" \
	  -e FASTAPI_SECRET_KEY="local-dev" \
	  -e ADMIN_USER_EMAIL="admin@luxauto.test" \
	  -e ENVIRONMENT="test"

backend-test-cov: ## Run tests with coverage report
	pytest backend/tests/ -v --tb=short --cov=backend --cov-report=term-missing \
	  -e DATABASE_URL="sqlite:///./_smoke_test.db" \
	  -e FASTAPI_SECRET_KEY="local-dev" \
	  -e ADMIN_USER_EMAIL="admin@luxauto.test" \
	  -e ENVIRONMENT="test"

backend-run: ## Run FastAPI dev server locally (SQLite)
	DATABASE_URL="sqlite:///./lux_local.db" \
	FASTAPI_SECRET_KEY="local-dev-key" \
	ADMIN_USER_EMAIL="admin@luxauto.test" \
	ENVIRONMENT="development" \
	uvicorn backend.main:app --reload --port 8080

backend-deploy: ## Deploy backend to Cloud Run (app-only / staging)
	@echo "▶ Running tests first…"
	$(MAKE) backend-test
	@echo "▶ Staging Dockerfile…"
	cp Dockerfile.backend Dockerfile
	gcloud run deploy $(SERVICE) \
	  --source . --project $(PROJECT_ID) --region $(REGION) \
	  --port 8080 --allow-unauthenticated \
	  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 \
	  --set-env-vars "DATABASE_URL=sqlite:////tmp/lux.db,FASTAPI_SECRET_KEY=$$(openssl rand -base64 48),ADMIN_USER_EMAIL=akushnir@bioenergystrategies.com,ENVIRONMENT=staging,LOG_LEVEL=INFO"
	rm -f Dockerfile

backend-logs: ## Tail Cloud Run logs
	gcloud run services logs tail $(SERVICE) --project $(PROJECT_ID) --region $(REGION)

# ─────────────────────────────────────────────────────────────────────────────
# GCP INFRASTRUCTURE
# ─────────────────────────────────────────────────────────────────────────────

gcp-setup: ## One-command GCP infra bootstrap (WIF, SQL, secrets, GitHub secrets)
	PROJECT_ID=$(PROJECT_ID) REGION=$(REGION) GITHUB_REPO=$(GITHUB_REPO) \
	  bash scripts/gcp-bootstrap.sh

secrets-show: ## Print current Secret Manager secret names for this project
	@echo "── Secret Manager secrets in $(PROJECT_ID) ──"
	@gcloud secrets list --project $(PROJECT_ID) --format="table(name,createTime)" 2>/dev/null \
	  || echo "(gcloud not authenticated or project not found)"

# ─────────────────────────────────────────────────────────────────────────────
# WEBAPP (Command Center — Google Apps Script)
# ─────────────────────────────────────────────────────────────────────────────

webapp-bootstrap: ## One-time Apps Script setup (clasp login → deploy → print GitHub secrets)
	cd webapp && bash bootstrap-cloudshell.sh

webapp-deploy: ## Redeploy the Command Center web app
	cd webapp && bash deploy.sh

# ─────────────────────────────────────────────────────────────────────────────
# GITHUB / CI
# ─────────────────────────────────────────────────────────────────────────────

pr: ## Open a PR from current branch → main via gh CLI
	gh pr create \
	  --repo $(GITHUB_REPO) \
	  --base main \
	  --fill \
	  --label "enhancement"

ci-status: ## Show the last 5 GitHub Actions runs
	gh run list --repo $(GITHUB_REPO) --limit 5
