#!/usr/bin/env node
/**
 * Lux Auto — Manheim API dev CLI
 * ------------------------------------------------------------------------
 * A CLI-native mirror of the Apps Script Manheim client (Code.gs). Lets you
 * test auth, MMR valuations, and listings searches against the Manheim
 * sandbox/prod API from your terminal — no GAS round-trip required.
 *
 * Usage (creds loaded from .env via `node --env-file=.env`, or `npm run mh`):
 *   npm run mh -- token
 *   npm run mh -- mmr <VIN> [--make Ferrari --model 488 --year 2019 --odometer 8000]
 *   npm run mh -- search --make Ferrari --yearFrom 2015 --priceTo 250000 --count 20
 *   npm run mh -- raw /valuation/v2/mmrtransaction/<VIN>
 *
 * Env (.env):
 *   MANHEIM_CLIENT_ID, MANHEIM_CLIENT_SECRET, MANHEIM_BASE_URL
 * ------------------------------------------------------------------------
 */

const BASE = (process.env.MANHEIM_BASE_URL || 'https://api.manheim.com').replace(/\/+$/, '');
const CLIENT_ID = process.env.MANHEIM_CLIENT_ID;
const CLIENT_SECRET = process.env.MANHEIM_CLIENT_SECRET;

const AUTH_URL = `${BASE}/oauth2/token.oauth2`;
const AUTH_URL_ALT = `${BASE}/id/credentials/accesstoken`;
const LISTINGS_URL = `${BASE}/marketplace/v1/listings`;
const MMR_URL = `${BASE}/valuation/v2/mmrtransaction`;

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function die(msg) {
  console.error(c.red(`✗ ${msg}`));
  process.exit(1);
}

function requireCreds() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    die('Missing MANHEIM_CLIENT_ID / MANHEIM_CLIENT_SECRET. Copy .env.example → .env and fill them in.');
  }
}

/** Parse `--key value` and `--flag` style args into an object. */
function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      (out._ ||= []).push(args[i]);
    }
  }
  return out;
}

/**
 * OAuth2 client_credentials — mirrors _getManheimToken() in Code.gs.
 * Primary: HTTP Basic auth. Fallback: client_id/secret in the form body.
 */
async function getToken() {
  requireCreds();
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  let resp = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (resp.status !== 200) {
    console.error(c.dim(`  primary auth → ${resp.status}, trying fallback endpoint…`));
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    resp = await fetch(AUTH_URL_ALT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  const text = await resp.text();
  if (resp.status !== 200) die(`Manheim auth failed (${resp.status}): ${text.slice(0, 300)}`);

  const data = JSON.parse(text);
  if (!data.access_token) die(`Auth response had no access_token: ${text.slice(0, 300)}`);
  return data;
}

/** Authenticated GET with 401 refresh + exponential backoff (mirrors _mhGet). */
async function mhGet(path, query = {}, { retries = 3 } = {}) {
  let token = (await getToken()).access_token;
  const qs = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const full = qs ? `${url}?${qs}` : url;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const resp = await fetch(full, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (resp.status === 200) return resp.json();
    if (resp.status === 404) return null;

    if (resp.status === 401 && attempt < retries) {
      console.error(c.dim(`  401 on attempt ${attempt} — refreshing token`));
      token = (await getToken()).access_token;
      continue;
    }
    if ((resp.status === 429 || resp.status >= 500) && attempt < retries) {
      const wait = 2 ** attempt * 500;
      console.error(c.dim(`  ${resp.status} on attempt ${attempt} — backing off ${wait}ms`));
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const body = await resp.text();
    die(`Manheim API ${resp.status} → ${full}\n${body.slice(0, 400)}`);
  }
  return null;
}

// ── Commands ──────────────────────────────────────────────────────────────
async function cmdToken() {
  const data = await getToken();
  const masked = data.access_token.slice(0, 6) + '…' + data.access_token.slice(-4);
  console.log(c.green('✓ Authenticated with Manheim'));
  console.log(`  base       ${c.cyan(BASE)}`);
  console.log(`  token      ${masked}`);
  console.log(`  expires_in ${data.expires_in || '?'}s`);
  if (data.token_type) console.log(`  token_type ${data.token_type}`);
}

async function cmdMmr(flags) {
  const vin = flags._?.[0];
  if (!vin) die('Usage: mmr <VIN> [--make --model --year --odometer]');
  const data = await mhGet(`${MMR_URL}/${encodeURIComponent(vin)}`, {
    make: flags.make,
    model: flags.model,
    year: flags.year,
    odometer: flags.odometer,
  });
  if (!data) return console.log(c.dim('No MMR data (404) for that VIN.'));
  const avg = data.average || data.averageAdjusted || data.mmr || 0;
  console.log(c.bold(`MMR for ${vin}`));
  console.log(`  average     ${c.green('$' + Math.round(avg).toLocaleString())}`);
  console.log(`  below (87%) $${Math.round(avg * 0.87).toLocaleString()}`);
  console.log(`  above (113%) $${Math.round(avg * 1.13).toLocaleString()}`);
  console.log(`  samples     ${data.sampleSize || data.count || '—'}`);
  if (flags.json) console.log(c.dim(JSON.stringify(data, null, 2)));
}

async function cmdSearch(flags) {
  const data = await mhGet(LISTINGS_URL, {
    make: flags.make,
    model: flags.model,
    yearFrom: flags.yearFrom,
    yearTo: flags.yearTo,
    priceFrom: flags.priceFrom,
    priceTo: flags.priceTo,
    odometerto: flags.odometerto || flags.mileageMax,
    count: flags.count || 20,
  });
  const items = data?.results || data?.listings || data?.items || [];
  console.log(c.bold(`${items.length} listing(s)`));
  for (const it of items.slice(0, Number(flags.count) || 20)) {
    const yr = it.year || it.modelYear || '';
    const mk = it.make || '';
    const md = it.model || '';
    const price = it.price || it.buyNowPrice || it.currentBid || '';
    console.log(`  ${c.cyan(`${yr} ${mk} ${md}`.trim())}  ${price ? '$' + Number(price).toLocaleString() : ''}  ${c.dim(it.vin || '')}`);
  }
  if (flags.json) console.log(c.dim(JSON.stringify(data, null, 2)));
}

async function cmdRaw(flags) {
  const path = flags._?.[0];
  if (!path) die('Usage: raw <path>  e.g. raw /valuation/v2/mmrtransaction/<VIN>');
  const data = await mhGet(path, {});
  console.log(JSON.stringify(data, null, 2));
}

const HELP = `${c.bold('Lux Auto — Manheim CLI')}

  ${c.cyan('token')}                         Authenticate and print a token summary
  ${c.cyan('mmr <VIN>')} [--make --model …]   MMR valuation for a VIN
  ${c.cyan('search')} [--make --yearFrom …]   Search marketplace listings
  ${c.cyan('raw <path>')}                      GET any Manheim path, print raw JSON

  Flags: append ${c.dim('--json')} to mmr/search for the full payload.
  Creds come from .env (MANHEIM_CLIENT_ID / _SECRET / _BASE_URL).`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  switch (cmd) {
    case 'token': return cmdToken();
    case 'mmr': return cmdMmr(flags);
    case 'search': return cmdSearch(flags);
    case 'raw': return cmdRaw(flags);
    case undefined:
    case 'help':
    case '--help':
    case '-h': return console.log(HELP);
    default: die(`Unknown command "${cmd}". Run with no args for help.`);
  }
}

main().catch((e) => die(e.message));
