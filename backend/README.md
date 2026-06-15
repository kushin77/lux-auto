# Lux-Auto Backend — FastAPI on Cloud Run

The Phase-2 heavy-compute / API layer for Lux Auto. A FastAPI service with
Google SSO (via oauth2-proxy), RBAC, audit logging, and a deal-management API —
Google-native and CLI-native end to end.

## Architecture

```
Browser ──▶ oauth2-proxy (Google SSO) ──▶ Cloud Run (this API) ──▶ Cloud SQL (Postgres)
                     │  sets X-Auth-Request-Email
                     ▼
            verified Google identity
```

- **Identity:** oauth2-proxy terminates Google OAuth at the edge and forwards
  `X-Auth-Request-Email`. `OAuthMiddleware` lifts it onto the request; endpoints
  enforce authorization via `RBACService`.
- **Data:** SQLAlchemy ORM over Postgres (Cloud SQL in prod, local Postgres in dev).
- **Observability:** structured JSON logs (structlog), `/metrics` (Prometheus), `/health`.

## Layout

```
backend/
├── main.py                 # app factory, DB bootstrap, session endpoints
├── cli.py                  # admin CLI (healthcheck, users, roles, seed)
├── auth/
│   ├── middleware.py       # X-Auth-Request-Email → request.state
│   ├── user_service.py     # UserRole enum + provisioning
│   ├── session_service.py  # issue / list / revoke sessions
│   ├── rbac_service.py     # role→permission matrix
│   └── audit.py            # append-only audit trail
├── database/
│   ├── __init__.py         # session registry + get_db dependency
│   └── models.py           # ORM models
├── routers/                # deals, analytics, audit, websocket
├── tests/                  # smoke tests (no live DB needed)
├── Dockerfile              # Cloud Run image (gunicorn + uvicorn workers)
├── docker-compose.yml      # local Postgres + API
└── deploy/cloud-run.sh     # gcloud deploy
```

## Local development

```bash
# Full stack in Docker (Postgres + API on :8080)
make -C backend up

# Or run against your own Postgres:
cp backend/.env.example backend/.env      # fill DATABASE_URL + FASTAPI_SECRET_KEY
make -C backend install
make -C backend db-init                   # create tables
make -C backend dev                       # uvicorn --reload on :8080
```

API docs: http://localhost:8080/docs · Health: `/health` · Metrics: `/metrics`

## Admin CLI

```bash
python -m backend.cli healthcheck
python -m backend.cli init-db
python -m backend.cli create-user --email alex@luxauto.com --role admin
python -m backend.cli set-role   --email jo@luxauto.com  --role analyst
python -m backend.cli list-users
python -m backend.cli list-deals --status scored
python -m backend.cli seed
```

## Tests

```bash
make -C backend test     # pytest smoke suite — imports the app, mounts routers
```

The smoke tests run without Postgres (SQLite stand-in) so they're CI-safe.

## Deploy to Cloud Run

1. Create the Cloud SQL Postgres instance and an Artifact Registry repo `lux-auto`.
2. Put secrets in Secret Manager:
   ```bash
   printf '%s' "$DATABASE_URL"     | gcloud secrets create lux-auto-database-url --data-file=-
   printf '%s' "$FASTAPI_SECRET_KEY" | gcloud secrets create lux-auto-secret-key  --data-file=-
   ```
3. Deploy:
   ```bash
   PROJECT_ID=my-proj REGION=us-central1 \
   CLOUDSQL_INSTANCE=my-proj:us-central1:luxauto \
   ADMIN_USER_EMAIL=alex@luxauto.com \
   make -C backend deploy
   ```

The service deploys with `--no-allow-unauthenticated`; front it with oauth2-proxy
(Google SSO) so `X-Auth-Request-Email` is set for every request.

## RBAC matrix

| Role | Inherits | Adds |
|---|---|---|
| `viewer` | — | read:deals, read:analytics |
| `user` | viewer | read:buyers |
| `analyst` | user | write:buyers, export:analytics, read:audit |
| `admin` | analyst | approve/reject:deals, write:config, manage:users |
| `super_admin` | admin | manage:roles, manage:api_keys, delete:any |

## Scaling notes

The WebSocket manager is in-process. For multi-instance Cloud Run, move
broadcasts to Pub/Sub or Memorystore (Redis) so events fan out across instances.
