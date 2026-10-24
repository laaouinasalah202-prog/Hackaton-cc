# LogLens Makefile — run backend (FastAPI) and frontend (Next.js)
# Backend deps are managed by uv (pyproject.toml / uv.lock).
# Usage: make help

SHELL        := /bin/bash
BACKEND_HOST ?= 0.0.0.0
BACKEND_PORT ?= 8000
FRONTEND_DIR := frontend

.DEFAULT_GOAL := help
.PHONY: help check-node check-uv install install-backend install-frontend env backend frontend dev start build clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ---------- Setup ----------

check-node:
	@command -v node >/dev/null 2>&1 || { echo "Node.js not found. Install Node 18+ (e.g. via nvm: https://github.com/nvm-sh/nvm)"; exit 1; }
	@node -e 'process.exit(parseInt(process.versions.node)>=18?0:1)' || { echo "Node $$(node -v) is too old. Next.js needs Node 18+ (20 LTS recommended)."; exit 1; }

$(FRONTEND_DIR)/node_modules:
	cd $(FRONTEND_DIR) && npm install

check-uv:
	@command -v uv >/dev/null 2>&1 || { echo "uv not found. Install it: curl -LsSf https://astral.sh/uv/install.sh | sh"; exit 1; }

install: install-backend install-frontend ## Install backend + frontend dependencies

install-backend: check-uv ## Install Python deps with uv (creates .venv)
	uv sync

install-frontend: check-node ## Install npm deps
	cd $(FRONTEND_DIR) && npm install

env: ## Create backend/.env from example if one exists
	@if [ ! -f .env ] && [ ! -f backend/.env ]; then \
		if [ -f backend/.env.example ]; then cp backend/.env.example backend/.env && echo "Created backend/.env"; \
		else echo "No .env found (mock LLM fallback will be used without GEMMA_API_KEY)"; fi; \
	fi

# ---------- Run ----------

backend: check-uv ## Run FastAPI backend on :8000 (hot reload)
	uv run uvicorn backend.main:app --host $(BACKEND_HOST) --port $(BACKEND_PORT) --reload

frontend: check-node $(FRONTEND_DIR)/node_modules ## Run Next.js frontend on :3000
	cd $(FRONTEND_DIR) && npm run dev

dev: check-uv check-node $(FRONTEND_DIR)/node_modules env ## Run backend AND frontend together (Ctrl+C stops both)
	@echo "Backend:  http://localhost:$(BACKEND_PORT)  (docs: /docs)"
	@echo "Frontend: http://localhost:3000"
	@trap 'kill 0' INT TERM EXIT; \
	uv run uvicorn backend.main:app --host $(BACKEND_HOST) --port $(BACKEND_PORT) --reload 2>&1 | sed -u 's/^/[backend] /' & \
	cd $(FRONTEND_DIR) && npm run dev

start: install dev ## First-time setup: install everything, then run both

# ---------- Build / cleanup ----------

build: ## Production build of the frontend
	cd $(FRONTEND_DIR) && npm run build

clean: ## Remove .venv, node_modules and build artifacts
	rm -rf .venv $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/.next
	find . -type d -name __pycache__ -prune -exec rm -rf {} +