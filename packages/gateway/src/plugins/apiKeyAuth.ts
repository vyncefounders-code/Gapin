import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import pool from "../db/client";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    rateLimitMap: Map<string, { count: number; ts: number }>;
  }
}

const apiKeyAuth: FastifyPluginAsync = async (fastify) => {
  // In-memory rate limit store
  fastify.decorate("rateLimitMap", new Map());

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
         3️⃣ Simple Rate Limit (per key)
      ---------------------------------------- */
      const now = Date.now();
      const WINDOW = 60000; // 1 minute
      const LIMIT = 1000;
      const entry = fastify.rateLimitMap.get(rawKey) || { count: 0, ts: now };

      if (now - entry.ts > WINDOW) {
        fastify.rateLimitMap.set(rawKey, { count: 1, ts: now });
      } else {
        if (entry.count >= LIMIT) {
          return reply.code(429).send({ error: "Rate limit exceeded" });
        }
        entry.count++;
        fastify.rateLimitMap.set(rawKey, entry);
      }

      /* ---------------------------------------
         4️⃣ Attach metadata to request
      ---------------------------------------- */
      (request as any).apiKey = {
        id: apiKeyRow.id,
        label: apiKeyRow.label,
      };

      /* ---------------------------------------
         5️⃣ Update last_used_at
      ---------------------------------------- */
      pool.query(
        `UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1`,
        [keyHash]
      );
    }
  );
};

export default apiKeyAuth;
