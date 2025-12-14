import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import pool from '../db/client';

interface CreateApiKeyBody {
  label?: string;
}

interface ApiKeyRow {
  id: number;
  user_id: number;
  key_hash: string;
  key_preview: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

export default async function apiKeysRoutes(fastify: FastifyInstance) {
  // POST /apikeys - Create new API key
  fastify.post(
    '/apikeys',
    { preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        if (typeof (fastify as any).authenticateUser === 'function') {
          return (fastify as any).authenticateUser(request as any, reply as any);
        }
        return reply.code(401).send({ error: 'Authentication required' });
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) return reply.code(401).send({ error: 'User not authenticated' });

      const { label } = request.body as any;

      try {
        // Generate random key (48 hex chars = 24 bytes)
        const rawKey = crypto.randomBytes(24).toString('hex');
        const keyPreview = rawKey.substring(0, 8);
        const keyHash = await bcrypt.hash(rawKey, 10);

        // Store in database
        const result = await pool.query(
          `INSERT INTO api_keys (user_id, key_hash, key_preview, label, is_active)
           VALUES ($1, $2, $3, $4, TRUE)
           RETURNING id, created_at, label`,
          [user.id, keyHash, keyPreview, label || 'default']
        );

        const keyRecord = result.rows[0];

        return reply.code(201).send({
          success: true,
          key: {
            id: keyRecord.id,
            plaintext: rawKey, // Only returned once
            preview: keyPreview,
            label: keyRecord.label,
            created_at: keyRecord.created_at,
            message: 'Save this key securely. You will not see it again.'
          }
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: 'Failed to create API key' });
      }
    }
  );

  // GET /apikeys - List all API keys for user
  fastify.get(
    '/apikeys',
    { preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        if (typeof (fastify as any).authenticateUser === 'function') {
          return (fastify as any).authenticateUser(request as any, reply as any);
        }
        return reply.code(401).send({ error: 'Authentication required' });
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) return reply.code(401).send({ error: 'User not authenticated' });

      try {
        const result = await pool.query(
          `SELECT id, label, created_at, last_used_at, is_active, key_preview
           FROM api_keys
           WHERE user_id = $1
           ORDER BY created_at DESC`,
          [user.id]
        );

        return reply.send({
          success: true,
          keys: result.rows.map((row: ApiKeyRow) => ({
            id: row.id,
            preview: row.key_preview,
            label: row.label,
            created_at: row.created_at,
            last_used_at: row.last_used_at,
            is_active: row.is_active
          }))
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: 'Failed to fetch API keys' });
      }
    }
  );

  // DELETE /apikeys/:id - Delete (revoke) an API key
  fastify.delete(
    '/apikeys/:id',
    { preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        if (typeof (fastify as any).authenticateUser === 'function') {
          return (fastify as any).authenticateUser(request as any, reply as any);
        }
        return reply.code(401).send({ error: 'Authentication required' });
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) return reply.code(401).send({ error: 'User not authenticated' });

      const keyId = parseInt((request.params as any).id);
      if (isNaN(keyId)) return reply.code(400).send({ error: 'Invalid key ID' });

      try {
        // Verify key belongs to user
        const checkResult = await pool.query(
          `SELECT id FROM api_keys WHERE id = $1 AND user_id = $2`,
          [keyId, user.id]
        );

        if (checkResult.rowCount === 0) {
          return reply.code(404).send({ error: 'API key not found or does not belong to you' });
        }

        // Soft delete (mark as inactive)
        await pool.query(
          `UPDATE api_keys SET is_active = FALSE WHERE id = $1`,
          [keyId]
        );

        return reply.send({
          success: true,
          message: 'API key revoked successfully'
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: 'Failed to delete API key' });
      }
    }
  );

  // Optional: PATCH /apikeys/:id - Update label
  fastify.patch(
    '/apikeys/:id',
    { preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        if (typeof (fastify as any).authenticateUser === 'function') {
          return (fastify as any).authenticateUser(request as any, reply as any);
        }
        return reply.code(401).send({ error: 'Authentication required' });
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) return reply.code(401).send({ error: 'User not authenticated' });

      const keyId = parseInt((request.params as any).id);
      const { label } = request.body as any;
      if (isNaN(keyId) || !label) return reply.code(400).send({ error: 'Invalid key ID or label' });

      try {
        const result = await pool.query(
          `UPDATE api_keys SET label = $1 WHERE id = $2 AND user_id = $3 RETURNING id, label`,
          [label, keyId, user.id]
        );

        if (result.rowCount === 0) {
          return reply.code(404).send({ error: 'API key not found' });
        }

        return reply.send({
          success: true,
          key: result.rows[0]
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: 'Failed to update API key' });
      }
    }
  );
}
