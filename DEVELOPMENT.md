# Lux Auto — Developer Guide (CLI-Native Workflow)

Lux Auto runs as a **Google Apps Script** web app (Sheets + Drive + Calendar + Gmail + Chat) with a **Manheim** API integration. This guide makes the whole thing CLI- and API-native so you can develop locally, version it in git, and ship from the terminal — fully Google-native, no paid dependencies.

## TL;DR

```bash
make setup        # install clasp + eslint, create .env
# edit .env  → add MANHEIM_CLIENT_ID / _SECRET and SCRIPT_ID
make login        # clasp login (Google OAuth, one time)
# put SCRIPT_ID into .clasp.json
make pull         # sync the live script down to these files
make watch        # auto-push on every save — your live dev loop
```

## Prerequisites

- **Node 18+** (ships native `fetch` and `--env-file`)
- A Google account with edit access to the Apps Script project
- A Manheim developer app (developer.manheim.com) for API credentials

## 1. One-time setup

```bash
make setup
```

This runs `npm install` (installs `@google/clasp` and ESLint locally) and copies `.env.example` → `.env`. Then:

1. **Get the Script ID.** Open the Apps Script project → **Project Settings** → copy the *Script ID*.
2. Paste it into **both** `.env` (`SCRIPT_ID=`) and `.clasp.json` (`"scriptId": "…"`).
3. **Authenticate clasp:** `make login` → opens a browser, authorize, done. Auth is stored in `~/.clasprc.json` (never committed).
4. **Add Manheim creds** to `.env`:
   ```
   MANHEIM_CLIENT_ID=...
   MANHEIM_CLIENT_SECRET=...
   MANHEIM_BASE_URL=https://api.manheim.com   # or the sandbox host while testing
   ```

## 2. The daily loop

| Command | What it does |
|---|---|
| `make pull` | Pull the live script into local files (do this before editing if others touch it) |
| `make watch` | `clasp push --watch` — every save pushes instantly to Apps Script |
| `make push` | One-shot push of all `.gs` / `.html` |
| `make open` | Open the script editor in the browser |
| `make logs` | Tail live execution logs (Stackdriver) |
| `make deploy` | Push + cut a new web-app deployment |
| `make lint` / `make fix` | ESLint over `.gs` + the Node CLI |

Only `*.gs`, `*.html`, and `appsscript.json` are pushed to Apps Script — `.claspignore` keeps the Python `backend/`, Node `tools/`, docs, and CI out of the GAS project.

## 3. Testing Manheim from the terminal

`tools/manheim.mjs` is a CLI mirror of the Apps Script Manheim client (`Code.gs`) — same OAuth2 `client_credentials` flow (HTTP Basic with form-body fallback), same MMR and listings endpoints. Test the API without a GAS round-trip:

```bash
make mh-token                       # verify auth, print token summary
make mh-mmr VIN=ZFF79ALA4J0231234   # MMR valuation for a VIN
make mh-search Q="Ferrari"          # quick listings search

# or call the CLI directly for full control:
npm run mh -- mmr ZFF79ALA4J0231234 --make Ferrari --model 488 --year 2019 --odometer 8000 --json
npm run mh -- search --make Lamborghini --yearFrom 2016 --priceTo 300000 --count 25
npm run mh -- raw /valuation/v2/mmrtransaction/ZFF79ALA4J0231234
```

Credentials load from `.env` automatically (`node --env-file=.env`). Switch `MANHEIM_BASE_URL` to the sandbox host for safe testing.

## 4. OAuth scopes (least privilege)

`appsscript.json` pins the minimum scopes the code actually uses:

| Scope | Used by |
|---|---|
| `…/auth/spreadsheets` | `SpreadsheetApp` — Pipeline, Analytics, Waitlist sheets |
| `…/auth/drive` | `DriveApp` — VehicleVault folder tree |
| `…/auth/calendar` | `CalendarApp` — auction / transport / recon events |
| `…/auth/forms` | `FormApp` — intake & onboarding forms |
| `…/auth/gmail.send` + `gmail.compose` | `GmailApp` — buyer notifications & drafts |
| `…/auth/script.external_request` | `UrlFetchApp` — Manheim API + Chat webhook |
| `…/auth/script.scriptapp` | `ScriptApp` — scan & daily-digest triggers |
| `…/auth/userinfo.email` | `Session.getActiveUser().getEmail()` |

If you add a new Google service, add its scope here, then `make push` — clasp re-prompts for consent on next run.

> **Timezone:** the manifest is set to `America/New_York`. Change `timeZone` in `appsscript.json` to match your operation, then push.

## 5. Script Properties (runtime secrets)

The live app reads secrets from **Script Properties**, not `.env`. clasp can't set these, so set them once in the editor (**Project Settings → Script Properties**) or via the `Setup` menu in the app:

- `MANHEIM_CLIENT_ID`, `MANHEIM_CLIENT_SECRET`
- `CHAT_WEBHOOK_URL` (optional, Google Chat alerts)

`.env` is for the **local CLI tools only**; Script Properties power the deployed app.

## 6. Git & CI

This folder is meant to live in the GitHub repo. `.gitignore` blocks `.env`, `node_modules/`, and clasp auth. Push as normal:

```bash
git add -A && git commit -m "CLI-native dev toolchain" && git push
```

`.github/workflows/ci.yml` lints every push/PR and, on `main`, can auto-`clasp push` if you add two repo secrets:

- `CLASPRC_JSON` — the contents of your local `~/.clasprc.json` (after `make login`)
- `SCRIPT_ID` — the Apps Script project ID

Without those secrets the deploy job is skipped, so CI is safe to enable immediately (lint-only).

## 7. Project layout

```
.
├── *.gs / *.html          # Apps Script source (pushed by clasp)
├── appsscript.json        # manifest: runtime, scopes, web-app config
├── .clasp.json            # clasp target (scriptId, rootDir)
├── .claspignore           # keeps non-GAS files out of the push
├── tools/manheim.mjs      # Manheim API dev CLI
├── backend/               # FastAPI heavy-compute layer (Phase 2, deployed separately)
├── Makefile               # one-word dev commands (`make help`)
├── package.json           # clasp + lint scripts
└── .github/workflows/     # lint + push CI
```

Run `make help` anytime for the command list.
