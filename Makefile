# Lux Auto — CLI-native dev commands.  Run `make help` for the list.
.DEFAULT_GOAL := help
.PHONY: help setup login pull push watch deploy open logs lint fix mh-token mh-mmr mh-search verify clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS=":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## Install dev deps (clasp, eslint) and copy .env
	npm install
	@test -f .env || cp .env.example .env
	@echo "→ Edit .env, then run: make login"

login: ## Authenticate clasp with your Google account
	npx clasp login

pull: ## Pull latest code from Apps Script into local files
	npx clasp pull

push: ## Push local .gs/.html to Apps Script
	npx clasp push

watch: ## Auto-push on every save (live dev loop)
	npx clasp push --watch

deploy: ## Push + create a new web-app deployment
	npx clasp push --force && npx clasp deploy

open: ## Open the script editor in the browser
	npx clasp open

logs: ## Tail Stackdriver execution logs
	npx clasp logs --watch

lint: ## Lint all .gs and Node CLI files
	npm run lint

fix: ## Auto-fix lint issues
	npm run lint:fix

mh-token: ## Test Manheim auth — fetch an access token
	npm run mh -- token

mh-mmr: ## MMR lookup by VIN:  make mh-mmr VIN=ZFF...
	npm run mh -- mmr $(VIN)

mh-search: ## Listings search:  make mh-search Q="Ferrari"
	npm run mh -- search "$(Q)"

verify: ## Lint + syntax-check the toolchain
	npm run verify

clean: ## Remove node_modules and local build artifacts
	rm -rf node_modules
