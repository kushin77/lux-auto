# Lux-Auto backend dev commands.  Run from repo root: `make -C backend help`
.DEFAULT_GOAL := help
PY ?= python3
.PHONY: help venv install dev test lint run up down logs db-init seed deploy

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS=":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install runtime + dev deps
	$(PY) -m pip install -r requirements-dev.txt

dev: ## Run the API locally with reload (needs DATABASE_URL)
	cd .. && uvicorn backend.main:app --reload --port 8080

test: ## Run the smoke test suite
	cd .. && $(PY) -m pytest backend/tests -q

lint: ## Lint with ruff
	cd .. && ruff check backend

run: up ## Alias for `up`

up: ## Start Postgres + API via docker compose
	docker compose -f docker-compose.yml up --build

down: ## Stop the local stack
	docker compose -f docker-compose.yml down

logs: ## Tail local stack logs
	docker compose -f docker-compose.yml logs -f api

db-init: ## Create tables from the ORM models
	cd .. && $(PY) -m backend.cli init-db

seed: ## Insert a sample deal
	cd .. && $(PY) -m backend.cli seed

deploy: ## Deploy to Cloud Run (set PROJECT_ID, CLOUDSQL_INSTANCE)
	cd .. && ./backend/deploy/cloud-run.sh
