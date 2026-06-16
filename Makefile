# ─────────────────────────────────────────────────────────────────────────────
# Lux Auto — unified CLI.  Run `make help` to see all commands.
#
# Stack: Google Apps Script (webapp/) + GHL CRM + Google Sheets
# No servers, no GCP, no Docker required.
# ─────────────────────────────────────────────────────────────────────────────
.DEFAULT_GOAL := help
.PHONY: help \
  setup login pull push watch deploy open logs lint fix verify clean \
  mh-token mh-mmr mh-search \
  webapp-bootstrap webapp-deploy sheets-open \
  pr ci-status

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
# APPS SCRIPT  (webapp/ — clasp dev loop)
# ─────────────────────────────────────────────────────────────────────────────

setup: ## Install clasp + dev deps
	cd webapp && npm install
	@echo "→ Run: make login"

login: ## Authenticate clasp with your Google account
	cd webapp && npx clasp login

pull: ## Pull live Apps Script source into local files
	cd webapp && npx clasp pull

push: ## Push local .gs/.html to Apps Script
	cd webapp && npx clasp push

watch: ## Auto-push on every save (live dev loop)
	cd webapp && npx clasp push --watch

deploy: ## Push + create a new versioned web-app deployment
	cd webapp && npx clasp push --force && npx clasp deploy

open: ## Open the Apps Script editor in the browser
	cd webapp && npx clasp open

logs: ## Tail Stackdriver execution logs
	cd webapp && npx clasp logs --watch

lint: ## Lint .gs files (ESLint)
	cd webapp && npm run lint

fix: ## Auto-fix lint issues
	cd webapp && npm run lint:fix

verify: ## Lint + syntax check
	cd webapp && npm run verify

clean: ## Remove node_modules
	rm -rf webapp/node_modules

# ─────────────────────────────────────────────────────────────────────────────
# WEBAPP LIFECYCLE
# ─────────────────────────────────────────────────────────────────────────────

webapp-bootstrap: ## One-time setup: clasp login → create project → deploy → print GitHub secrets
	cd webapp && bash bootstrap-cloudshell.sh

webapp-deploy: ## Redeploy the Command Center web app
	cd webapp && bash deploy.sh

sheets-open: ## Open the Lux Auto data spreadsheet in the browser
	@echo "Opening Sheets URL from Script Properties…"
	@cd webapp && npx clasp run getSheetsUrl 2>/dev/null || \
	  echo "Run getSheetsUrl() once in the Apps Script editor to get the URL."

# ─────────────────────────────────────────────────────────────────────────────
# MANHEIM CLI  (tools/manheim.mjs — local Node test harness)
# ─────────────────────────────────────────────────────────────────────────────

mh-token: ## Test Manheim auth — fetch + print token summary
	cd webapp && npm run mh -- token

mh-mmr: ## MMR lookup by VIN:   make mh-mmr VIN=ZFF79ALA4J0231234
	cd webapp && npm run mh -- mmr $(VIN)

mh-search: ## Listings search:  make mh-search Q="Ferrari"
	cd webapp && npm run mh -- search "$(Q)"

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
