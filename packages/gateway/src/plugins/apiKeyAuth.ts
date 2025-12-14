import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import pool from "../db/client";
import limiter from "../lib/rateLimiter";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

const apiKeyAuth: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    "authenticate",
    async function authenticate(
      request: FastifyRequest,
      reply: FastifyReply
    ) {
      /* ---------------------------------------
         1️⃣ Extract API key
      ---------------------------------------- */
      const header = request.headers.authorization;

      if (!header || !header.startsWith("Bearer ")) {
        return reply.code(401).send({ error: "Missing API Key" });
      }

      const rawKey = header.replace("Bearer ", "").trim();
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

      /* ---------------------------------------
         2️⃣ Validate key in DB
      ---------------------------------------- */
      const result = await pool.query(
        `SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = TRUE`,
        [keyHash]
      );

      if (result.rowCount === 0) {
        return reply.code(401).send({ error: "Invalid API Key" });
      }

      const apiKeyRow = result.rows[0];

      /* ---------------------------------------
         3️⃣ Rate Limit (Redis-backed, per api_key id)
      ---------------------------------------- */
      const WINDOW_SEC = 60; // 1 minute window
      const LIMIT = 1000;
      try {
        const keyId = String(apiKeyRow.id);
        const res = await limiter.increment(keyId, WINDOW_SEC, LIMIT);
        // Set rate limit headers
        reply.header('X-RateLimit-Limit', String(LIMIT));
        reply.header('X-RateLimit-Remaining', String(res.remaining));
        reply.header('X-RateLimit-Reset', String(res.reset));
        if (!res.allowed) {
          return reply.code(429).send({ error: 'Rate limit exceeded' });
        }
      } catch (limErr) {
        // If limiter fails, allow request but log warning
        fastify.log.warn({ limErr }, 'Rate limiter error - allowing request');
      }

      /* ---------------------------------------
         4️⃣ Attach metadata to request
      ---------------------------------------- */
      (request as any).apiKey = {
        id: apiKeyRow.id,
        label: apiKeyRow.label,
      };

      /* ---------------------------------------
         5️⃣ Update last_used_at (await + error handling)
      ---------------------------------------- */
      try {
        await pool.query(`UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1`, [keyHash]);
      } catch (err) {
        fastify.log.warn({ err }, 'Failed to update last_used_at for API key');
      }
    }
  );
};

export default apiKeyAuth;
