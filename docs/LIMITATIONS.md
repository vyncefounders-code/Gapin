# Limitations & Known Environment Constraints

This file documents current limitations, blockers, and environment notes discovered during the audit and follow-up fixes.

1) Local Docker / infra availability
- Docker Desktop on this machine returned HTTP 500 errors when pulling images (postgres, redpanda). As a result the automated migration (`npm run db:init`) could not connect to Postgres and migrations could not be applied locally.

2) Migrations vs. DB state
- A new migration `006_add_index_key_preview.sql` was added to index `key_preview` for O(1) lookups. If you run `npm run db:init` (after Docker/DB is running) it will apply all migrations from `src/db/migrations`.

3) Signature verification requirement
- Signature verification is now mandatory in non-SKIP_INFRA (production) mode. In dev mode (`SKIP_INFRA=true`) it remains optional to allow local testing without secrets.

4) API key lookup design tradeoff
- The validator uses `key_preview` (first 8 chars) to narrow candidates, then runs bcrypt.compare against hashes for the small candidate set. This avoids full-table bcrypt scans but introduces reliance on collision-resistant previews. If you require cryptographic guarantees, consider storing an HMAC of the key for direct lookup.

5) Rate limiter fallback
- The Redis-backed limiter falls back to an in-memory bucket when `REDIS_URL` is not configured. In-memory is not suitable for multi-instance deployments.

6) Consumer & Kafka
- A simple consumer was implemented to log messages, but end-to-end tests require Kafka/Redpanda running. Until Docker infra is available, consumer behaviour can't be validated.

7) Testing status
- TypeScript build verified OK locally.
- Runtime integration tests (DB + Kafka) are pending until infra is available.

8) Recommended immediate actions
- Fix Docker Desktop (restart, diagnostics, or reset) so `docker compose` can pull images.
- Run `npm run db:init` after Postgres is available.

If you want, I can produce a concise checklist of commands to run on your machine to recover Docker and apply migrations.
