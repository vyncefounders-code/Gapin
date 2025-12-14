# Code Review & Progress Report — Dec 14, 2025

**Scope:** Review GAPIN / AIBBAR repository against the MVP execution plan and perform a focused code review (gateway, auth, API keys, migrations, SDKs).  
**Author:** Automated code review (paired with developer)  

---

## 1) Executive summary — progress vs MVP plan

Completed / Present (foundation and many Phase 2 items):
- API Key system: plugin (`src/plugins/apiKeyAuth.ts`), controller (`src/controllers/keyController.ts`), routes (`src/routes/key.ts`) and migration (`src/db/migrations/001_create_api_keys.sql`) are implemented.
- User auth system: registration, login, and `/auth/me` are implemented in `src/routes/auth.ts`; migration exists (`002_create_users.sql`).
- Basic rate-limiting: in-memory per-key limiter implemented inside `apiKeyAuth` (window + limit).
- DB init script (`packages/gateway/scripts/init-db.js`) creates `events` and `users` tables and index on events.
- SDKs: `packages/sdk-js` and `packages/sdk-python` present with basic clients.

Partially completed / implemented but needs improvement:
- Protected routes: most protected by `fastify.authenticate` via the auth plugin; some older code paths still show unprotected endpoints.
- Rate limiting: works but in-memory (not suitable for multi-instance production).
- Event persistence: `init-db.js` creates `events` table (script-based); no formal migration file exists for `events` table.

Not started / Missing (per MVP execution plan):
- AIBBAR event schema (strict validator) and signature verification middleware are not implemented.
- Dashboard (Next.js) not present.
- Distributed rate limiter (Redis) not implemented.
- Prometheus metrics and `/metrics` endpoint missing.
- Full CI tests (unit/integration) are missing.

Critical issue blocking safe deployment:
- `packages/gateway/src/index.ts` contains unresolved Git merge conflict markers (<<<<<<<, =======, >>>>>>>). This prevents building/running and must be resolved immediately.

---

## 2) Detailed code review — issues, risks, and improvements

Priority (P0 = critical, P1 = high, P2 = medium, P3 = low)

### P0 — Must fix before deployment
- Merge conflict in `packages/gateway/src/index.ts` (lines include `<<<<<<< HEAD` etc.). This file currently contains duplicated and conflicting startup and route logic. Fix by merging the intended protected-route design, removing conflict markers, and verifying the startup sequence (DB connect → Kafka producer → Kafka consumer subscribe/start → Fastify listen).
- Inconsistent event-route protection: two variants of `/events/publish` and `/events/read` exist in the merged file (protected and unprotected). Ensure a single canonical secured implementation (use `preHandler: fastify.authenticate` for protected endpoints or explicit public routes for health only).

### P1 — High importance
- Rate limiter implementation (in `apiKeyAuth.ts`) is in-memory (`fastify.rateLimitMap`). This will not scale across multiple instances; replace with Redis or an external store for production. Also the current key used in the map uses `rawKey` — consider using `apiKeyId` instead to avoid storing raw keys as map keys.
- `apiKeyAuth` updates `last_used_at` via `pool.query(...)` without `await` or error handling. This may cause unobserved failures. Use `await pool.query(...)` and log errors if any.
- Key hashing: current implementation uses SHA-256 (`crypto.createHash('sha256')`) and stores the hex digest. It's acceptable, but for higher security consider using HMAC with a server-side secret or using a slow hash (bcrypt/argon2) if keys are user-supplied secrets. At minimum, ensure secure random generation and do not leak raw keys in logs.
- `EventPublisher.publish` swallows the underlying error and throws a generic Error('Failed to publish event') — surface original error (or chain/cause) for diagnostics (`throw error` or include message).
- `EventConsumer` uses `console.error` to report parsing errors; replace with `fastify.log.error` (or a logger) so logs are structured and centralized.

### P2 — Medium importance
- Event DB insert uses `JSON.stringify(eventData)` in an SQL parameter. While functional, prefer passing JS objects to `pg` to make clear use of `JSONB`, or use parameterized query with `eventData` as an object (pg will handle JSON serialization). Also return inserted id in controller if needed.
- Some `reply.send` and `return reply.code(...).send(...)` usage is mixed — prefer consistent explicit `return reply.code(...).send(...)` for non-2xx responses.
- Many try/catch blocks log raw `error` object without ensuring it's serializable. Use `error instanceof Error ? error.message : String(error)` and include stack when appropriate.
- Key preview length is 8 hex characters; consider prefixing with `sk_` for UX/identification (e.g., `sk_ab12cd34`) and storing preview safely.
- `apiKeyAuth` rate limit constants (`WINDOW`, `LIMIT`) are hard-coded in plugin; allow configuration via env or plugin options per deployment/team.

### P3 — Low importance / suggestions
- Add OpenAPI (Swagger) specification for all endpoints for consumer and dashboard integration.
- Add unit & integration tests for auth flows, key rotation, and publish/read events.
- Add structured metrics (`/metrics`) and instrument publish/consume flows (latency, success/failure counts).
- Consider using UUIDs for API key IDs in DB to avoid enumeration via small integer IDs.
- Add email normalization and uniqueness checks (lowercase trimming) on user registration.
- Harden user login responses to avoid username enumeration: use a single generic 'Invalid credentials' response for both missing user and wrong password (already done, good).

---

## 3) Security observations

- Raw key exposure: raw API keys are returned once on generation (correct), but code paths that use `rawKey` as a map key (rateLimitMap) hold the raw key in server memory as a string key — avoid storing raw keys as identifiers; use the key's DB id instead.
- Recommend adding rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) on protected responses.
- Consider rotating `sha256` hashing to use `HMAC` with an application secret so that a leaked DB of hashes is less useful for attackers.

---

## 4) Progress checklist vs MVP_EXECUTION_PLAN

Completed (or present):
- [x] `api_keys` migration (001_create_api_keys.sql)
- [x] API key routes and controller
- [x] `users` migration (002_create_users.sql)
- [x] Auth routes (`/auth/register`, `/auth/login`, `/auth/me`)
- [x] API key plugin registered and used as `fastify.authenticate`
- [x] Basic in-memory rate limiting
- [x] DB init script creating `events` table and index
- [x] JS & Python SDKs present

Partial / needs hardening:
- [ ] Rate limiting: move from in-memory to Redis (distributed)
- [ ] Add per-key quotas and admin controls in DB
- [ ] Add API key rotation/revocation workflows to be audited
- [ ] Ensure all protected endpoints use auth plugin (clean index.ts conflicts first)

Not started:
- [ ] AIBBAR event schema + validator
- [ ] Signature verification middleware (HMAC/JWT) for event integrity
- [ ] Dashboard (Next.js) pages and APIs
- [ ] Prometheus metrics + `/metrics`
- [ ] Automated testing and CI integration

---

## 5) Concrete next steps (recommended immediate work)

1. Stop other work and fix the merge conflict in `packages/gateway/src/index.ts` (critical). Verify a single, clear startup sequence and canonical route definitions.
2. Replace `fastify.rateLimitMap` with Redis-backed rate limiter (or adapt to use `fastify-rate-limit` plugin configured for Redis) and switch map key to `apiKeyId`.
3. `await` and handle the `UPDATE api_keys SET last_used_at = NOW()` query in `apiKeyAuth` and log failures.
4. Improve logging: replace `console.error` with structured logger, include error messages and optional stack traces (controlled by LOG_LEVEL).
5. Add `events` migration SQL (create table + index) into `packages/gateway/src/db/migrations/003_create_events.sql` (or rename existing script to migration) so schema versioning is consistent.
6. Add unit and integration tests for: key generation/rotation/revocation, auth flows, rate limiting behavior, event publish/read end-to-end.
7. Plan dashboard scaffolding and API endpoints; add OpenAPI spec to accelerate frontend integration.

---

## 6) Files of interest (quick links)

- `packages/gateway/src/index.ts` — CRITICAL: contains merge markers
- `packages/gateway/src/plugins/apiKeyAuth.ts` — auth + in-memory rate limiter
- `packages/gateway/src/controllers/keyController.ts` — key generation/rotate/revoke
- `packages/gateway/src/routes/key.ts` — key routes
- `packages/gateway/src/routes/auth.ts` — user registration/login/profile
- `packages/gateway/src/db/migrations/001_create_api_keys.sql` — api key migration
- `packages/gateway/src/db/migrations/002_create_users.sql` — users migration
- `packages/gateway/scripts/init-db.js` — creates `events` table + index
- `packages/gateway/src/events/publish.ts` — kafka producer wrapper
- `packages/gateway/src/events/consume.ts` — kafka consumer wrapper

---

## 7) Estimated effort to reach MVP-complete (priority ordering)

- Fix merge conflict + sanity run (local): 0.5 day
- Replace in-memory rate limiter with Redis-backed solution + test: 1–2 days
- Add `events` migration + verify DB init integration: 0.5 day
- Add signature verification middleware + event schema validator: 1–2 days
- Add basic Prometheus metrics + `/metrics`: 0.5–1 day
- Create minimal Next.js dashboard scaffolding (login + API key management + event viewer): 7–10 days (MVP UI)
- Tests & CI (unit + integration): 3–5 days

---

## 8) Appendix — suggested code fixes (examples)

1) Resolve merge markers: keep the protected route variant and remove duplicate definitions. Example snippet for `/events/publish`:

```ts
fastify.post('/events/publish', { preHandler: fastify.authenticate }, async (request, reply) => {
  const { topic, message } = request.body as { topic: string; message: any };
  // validate topic/message
  // publish via eventPublisher
  // store to DB with await and return inserted id
});
```

2) Update `apiKeyAuth` last_used_at update with `await` and try/catch:

```ts
try {
  await pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1', [keyHash]);
} catch (err) {
  request.log.warn({ err }, 'Failed to update last_used_at');
}
```

3) Use `fastify.log` in `consume.ts` instead of `console.error`.

---

## 9) Output artifact

- This review file: `docs/reports/2025-12-14-code-review-findings.md`

---

If you want, I can immediately:
- Resolve the merge conflict in `packages/gateway/src/index.ts` (I will propose a merged version and run TypeScript build), or
- Implement Redis-backed rate limiter and update `apiKeyAuth`, or
- Add `events` migration SQL and commit.

Which of these should I take next?