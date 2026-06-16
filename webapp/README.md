# Lux Auto — Command Center (Google Apps Script web app)

A **Google-hosted, Google-native** operations tool. The browser only ever talks to
Google (Apps Script); Apps Script talks to the CRM backend **server-side**, with the
token held in Script Properties. The CRM vendor is never named or exposed in the UI.

```
Browser ──▶ Apps Script web app (script.google.com)  ──server-side──▶  CRM backend API
            • Google-native Lux UI                                      (token in Script Properties)
            • google.script.run only                                    • mapped to clean Lux objects
```

## Files
| File | Role |
|---|---|
| `Code.gs` | `doGet()` web-app entry, serves the UI |
| `Config.gs` | constants + Script Properties access (secrets) |
| `Auth.gs` | access allowlist + admin check (server-side) |
| `Api.gs` | CRM v2 client, caching, vendor→Lux mappers, demo fallback |
| `CommandCenter.html` | Google-native UI (KPIs, pipeline board, buyers) |
| `appsscript.json` | manifest — V8, least-privilege scopes, web-app config |

## Deploy
```bash
cd webapp
npm install
npx clasp login
npx clasp create --type webapp --title "Lux Auto — Command Center"   # writes scriptId into .clasp.json
npx clasp push
npx clasp deploy --description "Lux Command Center"
npx clasp open      # opens the script editor
```
Then in the Apps Script editor: **Deploy → New deployment → Web app**
- Execute as: **Me**
- Who has access: **Anyone within <your org>** (or "Only myself" to start)
- Copy the **/exec** URL — that's your Lux Auto tool. Bookmark it (it's a `script.google.com` URL — pure Google, no vendor).

## Configure (Project Settings → Script properties)
| Key | Value |
|---|---|
| `LC_API_TOKEN` | CRM backend Private Integration token (from `lux-ghl-api-token` in GSM) |
| `LC_LOCATION_ID` | CRM backend location id |
| `ALLOWED_EMAILS` | (optional) comma-separated allowlist; blank = anyone the deployment allows |
| `ADMIN_EMAILS` | comma-separated admins who can move/approve deals |

**Until `LC_API_TOKEN` + `LC_LOCATION_ID` are set, the app runs in preview mode**
with sample deals — so you can deploy and see the UI immediately, then wire the
token to go live. (Token lives in GSM per the automation blueprint.)

## Enterprise notes
- **Secrets** never touch code or the client — only Script Properties, server-side.
- **Caching** (CacheService, 90s) cuts API calls and respects rate limits.
- **Access control**: manifest `access: DOMAIN` + optional `ALLOWED_EMAILS` allowlist + admin gating on writes.
- **White-label**: no vendor name, domain, or IDs are ever sent to the browser — the
  server maps all vendor JSON into clean Lux objects first.
- **Graceful degradation**: data-source errors show a friendly banner and keep the UI usable.
- **Least privilege scopes**: only `script.external_request` + `userinfo.email` + `script.scriptapp`.
