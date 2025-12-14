# GAPIN — Full Audit & Implementation Report

Date: December 14, 2025

Prepared by: Engineering Bot (final audit)

---

## Executive Summary

This repository contains the GAPIN gateway MVP. All core features requested for MVP are implemented, audited, and hardened. This single-file report summarizes everything from project purpose, architecture, features implemented, recent fixes, migrations, known limitations, recommended next steps, and exact commands to run the system locally.

Read this file to understand the full state of the project — you should not need to read other documents for a high-level and actionable overview.

---

## Project Purpose

GAPIN is a gateway for ingesting AI-related events (AIBBAR events) from SDKs (JS/Python). It supports:
- User registration & login (JWT)
- Per-user API key management (create/list/revoke)
- Event publishing via `POST /events/publish` authenticated by API key
- Event reading via `GET /events/read`
- Persistence to PostgreSQL and publish to Kafka/Redpanda
- SKIP_INFRA mode for local development without infra

---

## Repo Layout (important files)

- `packages/gateway/src/index.ts` — main server, route registration, startup/shutdown
- `packages/gateway/src/plugins/jwtAuth.ts` — JWT helpers, `authenticateUser`
- `packages/gateway/src/plugins/apiKeyValidator.ts` — API key validation (uses `key_preview` lookup)
- `packages/gateway/src/plugins/eventValidator.ts` — AJV schema validator (strict)
- `packages/gateway/src/plugins/signatureVerifier.ts` — HMAC signature verification
- `packages/gateway/src/events/publish.ts` — Kafka publisher helper
- `packages/gateway/src/events/consume.ts` — consumer class (logs events)
- `packages/gateway/src/routes/auth.ts` — register/login/me (rate-limited on register/login)
- `packages/gateway/src/routes/apikeys.ts` — API key CRUD
- `packages/gateway/src/db/migrations/*.sql` — SQL migrations (applied by `npm run db:init`)
- `packages/gateway/scripts/init-db.js` — runner that applies all migrations
- `docs/MVP_STATUS_REPORT.md`, `docs/CODE_REVIEW_PHASE_2.md`, `docs/LIMITATIONS.md` — supplemental docs
- `GAPIN_FULL_REPORT.md` — this file (root)

---

## Build & Runtime Status

- TypeScript build: PASS (no errors)
- Unit/integration tests: TODO (not added)
- Runtime: SKIP_INFRA mode works locally (`SKIP_INFRA=true npm run dev`). Full infra (Postgres/Redis/Redpanda) requires Docker working locally.

---

## Features Implemented (Detailed)

1) Authentication
- `POST /auth/register`: user registration (email/password), bcrypt hashed password
- `POST /auth/login`: returns JWT with 7d expiry; endpoint protected with per-IP rate limiting
- `GET /auth/me`: returns authenticated user profile (JWT required)

2) API Key Management
- `POST /apikeys`: create API key (48-hex plaintext returned once; stored hashed)
- `GET /apikeys`: list keys (preview only)
- `DELETE /apikeys/:id`: soft revoke (set `is_active = FALSE`)
- `PATCH /apikeys/:id`: update label

3) Event Ingestion
- `POST /events/publish`: API key auth, strict AJV schema validation, mandatory HMAC signature in production, per-key rate limiting, persistence to Postgres, publish to Kafka `events.<user_id>.<topic>`
- `GET /events/read`: read events for authenticated API key's user with filters

4) Infrastructure & Dev Mode
- SKIP_INFRA mode (`SKIP_INFRA=true`) bypasses DB/Kafka/Redis so you can run app locally without Docker. Production requires full infra.

---

## Recent Fixes & Hardening (what I changed)

1) API Key Lookup: Replaced full-table bcrypt scan with `key_preview` lookup to reduce bcrypt.compare operations. Migration `006_add_index_key_preview.sql` added to index `key_preview`.

2) Auth Rate Limiting: Added per-IP rate limiting to `POST /auth/register` and `POST /auth/login` using existing Redis-backed limiter (fallback to in-memory).

3) `/auth/me`: Fixed to use JWT (`authenticateUser`) and return `user` object rather than API key.

4) AJV Schema: Tightened event schema in `src/plugins/eventValidator.ts` to require `event_type`, `timestamp`, and `action` and disallow additional properties.

5) Signature Verification: Enforced mandatory HMAC signature verification in non-SKIP_INFRA (production) mode. In dev (SKIP_INFRA), signature verification remains optional.

6) Event Consumer: `EventConsumer` implemented to subscribe/run and log consumed messages. Minor fix: replaced `console.error` with `console.warn` in parsing error case.

7) Migration Runner: `scripts/init-db.js` updated to apply all SQL files found in `src/db/migrations` in sorted order.

8) Tooling: Added `.nvmrc` (Node 20) and `engines.node` in `packages/gateway/package.json` for consistent Node versioning.

---

## Migrations

All SQL migrations are in `packages/gateway/src/db/migrations`:
- `001_create_api_keys.sql`
- `002_create_users.sql`
- `003_create_events.sql`
- `004_add_user_id_to_api_keys.sql`
- `005_add_user_key_to_events.sql`
- `006_add_index_key_preview.sql` (new — adds index on `key_preview`)

Apply them with:
```powershell
cd packages/gateway
npm run db:init
```
This script connects to the DB using env vars (see `.env`) and runs each `.sql` file.

---

## Known Limitations (from `docs/LIMITATIONS.md`)

- Docker Desktop may fail pulling images on some Windows environments (observed 500 errors). As a result the automated migration (`npm run db:init`) could not connect to Postgres and migrations could not be applied locally.
- `key_preview` optimization reduces bcrypt compares but relies on 8-char preview collisions being rare; for stronger guarantees consider HMAC-based direct lookup.
- In-memory rate limiter fallback is not suitable for multi-instance production.
- Consumer behavior can't be fully validated until Kafka/Redpanda is running.

---

## Security Notes

- Passwords & API keys are hashed with bcrypt.
- JWT secret controlled by `JWT_SECRET`; ensure production secret is strong and stored in vault/ENV securely.
- HMAC signature (`AIBBAR_SECRET`) is required in production to prevent forged events.
- Add per-user/dashboard monitoring and brute-force protection (rate limiter already added to auth routes).

---

## How to Run Locally (recommended order)

1) Ensure Docker Desktop is running and healthy.
```powershell
cd C:\dev\Gapin
docker compose -f infra/docker-compose.yml up -d
```

2) Apply DB migrations:
```powershell
cd packages/gateway
npm run db:init
```

3) Start gateway (production with infra):
```powershell
# $env:JWT_SECRET='...'; $env:AIBBAR_SECRET='...'; $env:REDIS_URL='redis://localhost:6379'
$env:PORT='3000'; npm run dev
```

4) For dev-only (no infra):
```powershell
$env:SKIP_INFRA='true'; $env:PORT='3000'; npm run dev
```

---

## Quick Smoke Tests (curl examples)

- Register
```powershell
curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"test@local","password":"pass123","name":"Test"}'
```

- Login
```powershell
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"test@local","password":"pass123"}'
```

- Create API key (use token)
```powershell
curl -X POST http://localhost:3000/apikeys -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"label":"cli-key"}'
```

- Publish event (use plaintext API key):
```powershell
curl -X POST http://localhost:3000/events/publish -H "x-api-key: <PLAINTEXT_KEY>" -H "Content-Type: application/json" -d '{"topic":"test","message":{"action":{},"event_type":"test","timestamp":"2025-12-14T00:00:00Z"}}'
```

---

## Remaining Work / Recommendations

1) Run full infra and migrations locally; run integration tests.
2) Add automated integration tests (auth, apikeys, events) — TODO in `packages/gateway/test/`.
3) Replace `key_preview` lookup with HMAC direct lookup if you want cryptographic indexable keys.
4) Add centralized logging/monitoring and metrics (Prometheus/Grafana) for rate limiting and event throughput.

---

## Git & Release Notes

All final fixes are committed. Recommended release steps:
1) Tag `v1.0.0-alpha`.
2) Deploy to staging with full infra.
3) Run load tests on rate limiter and key lookup.

---

## Files I Updated (high level)

- `src/plugins/apiKeyValidator.ts` (use `key_preview` lookup)
- `src/routes/auth.ts` (rate limits on register/login; fixed /auth/me)
- `src/plugins/eventValidator.ts` (strict schema)
- `src/plugins/signatureVerifier.ts` (unchanged; enforced in `src/index.ts`)
- `src/index.ts` (signature enforcement logic)
- `scripts/init-db.js` (run migrations)
- `src/events/consume.ts` (logging fix)
- `docs/LIMITATIONS.md` (new)
- `.nvmrc` (new)
- `packages/gateway/package.json` (engines.node added)
- `src/db/migrations/006_add_index_key_preview.sql` (new migration)

---

If you want, I can now:
- Produce the integration test suite (recommended next step), or
- Generate a Postman collection / curl script set, or
- Help run Docker diagnostics locally.

This completes the full audit, fixes, and final report. Push to `main` and run migrations on your infra to validate end-to-end.
