import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import pool from '../db/client';
import limiter from '../lib/rateLimiter';

const apiKeyValidator: FastifyPluginAsync = async (fastify) => {
  // Validates x-api-key header and attaches user + key info to request
  fastify.decorate('validateApiKey', async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKeyHeader = request.headers['x-api-key'];

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      return reply.code(401).send({ error: 'Missing x-api-key header' });
    }

    try {
      // Use key preview (first 8 chars) to limit candidate rows and avoid O(n) bcrypt checks
      const preview = apiKeyHeader.substring(0, 8);

      const result = await pool.query(
        `SELECT ak.id, ak.key_hash, ak.user_id, ak.label, ak.is_active, ak.last_used_at
         FROM api_keys ak
         WHERE ak.key_preview = $1 AND ak.is_active = TRUE`,
        [preview]
      );

      if (result.rowCount === 0) {
        // No candidate with matching preview
        return reply.code(401).send({ error: 'Invalid API key' });
      }

      // Compare only against the small candidate set
      let matchedKey: any = null;
      for (const row of result.rows) {
        const isMatch = await bcrypt.compare(apiKeyHeader, row.key_hash);
        if (isMatch) {
          matchedKey = row;
          break;
        }
      }

      if (!matchedKey) {
        return reply.code(401).send({ error: 'Invalid API key' });
      }

      // Apply rate limiting (per API key ID)
      const WINDOW_SEC = parseInt(process.env.RATE_LIMIT_WINDOW || '60');
      const LIMIT = parseInt(process.env.RATE_LIMIT_MAX || '100');

      try {
        const res = await limiter.increment(String(matchedKey.id), WINDOW_SEC, LIMIT);
        reply.header('X-RateLimit-Limit', String(LIMIT));
        reply.header('X-RateLimit-Remaining', String(res.remaining));
        reply.header('X-RateLimit-Reset', String(res.reset));

        if (!res.allowed) {
          return reply.code(429).send({ error: 'Rate limit exceeded' });
        }
      } catch (limErr) {
        fastify.log.warn({ limErr }, 'Rate limiter error - allowing request');
      }

      // Update last_used_at
      try {
        await pool.query(
          `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
          [matchedKey.id]
        );
      } catch (err) {
        fastify.log.warn({ err }, 'Failed to update last_used_at');
      }

      // Attach to request
      (request as any).apiKey = {
        id: matchedKey.id,
        user_id: matchedKey.user_id,
        label: matchedKey.label
      };

      return;
    } catch (err) {
      fastify.log.error({ err }, 'API key validation error');
      return reply.code(500).send({ error: 'Internal error during authentication' });
    }
  });
};

export default apiKeyValidator;
