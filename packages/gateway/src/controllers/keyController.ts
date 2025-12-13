import { FastifyRequest, FastifyReply } from "fastify";
import crypto from "crypto";
import pool from "../db/client";

/* ---------------------------------------------
   Types
---------------------------------------------- */
interface CreateKeyBody {
  label?: string;
}

interface EmptyBody {} // for routes that don't need a body

/* ---------------------------------------------
   Utilities
---------------------------------------------- */
function generateRawKey() {
  return crypto.randomBytes(32).toString("hex");
}

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function preview(key: string) {
  return key.substring(0, 8);
}

/* ---------------------------------------------
   1️⃣ Generate New API Key
---------------------------------------------- */
export async function generateApiKey(
  request: FastifyRequest<{ Body: CreateKeyBody }>,
  reply: FastifyReply
) {
  try {
    const label = request.body?.label || "default";

    const rawKey = generateRawKey();
    const keyHash = hashKey(rawKey);
    const keyPreview = preview(rawKey);

    const result = await pool.query(
      `
      INSERT INTO api_keys (key_hash, key_preview, label)
      VALUES ($1, $2, $3)
      RETURNING id, label, created_at;
      `,
      [keyHash, keyPreview, label]
    );

    return reply.send({
      success: true,
      apiKey: rawKey, // show once
      preview: keyPreview,
      metadata: result.rows[0],
      note: "Store this key securely. It will NOT be shown again."
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to generate API key" });
  }
}

/* ---------------------------------------------
   2️⃣ List API Keys
---------------------------------------------- */
export async function listApiKeys(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const result = await pool.query(
      `
      SELECT id, label, key_preview, created_at, last_used_at, is_active
      FROM api_keys
      ORDER BY created_at DESC;
      `
    );

    return reply.send({
      success: true,
      keys: result.rows
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to list API keys" });
  }
}

/* ---------------------------------------------
   3️⃣ Revoke API Key
---------------------------------------------- */
export async function revokeApiKey(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const result = await pool.query(
      `UPDATE api_keys SET is_active = FALSE WHERE id = $1 RETURNING id;`,
      [id]
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ error: "API key not found" });
    }

    return reply.send({
      success: true,
      message: `API Key ${id} revoked`
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to revoke API key" });
  }
}

/* ---------------------------------------------
   4️⃣ Rotate API Key
---------------------------------------------- */
export async function rotateApiKey(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const rawKey = generateRawKey();
    const keyHash = hashKey(rawKey);
    const keyPreview = preview(rawKey);

    const result = await pool.query(
      `
      UPDATE api_keys
      SET key_hash = $1,
          key_preview = $2,
          last_used_at = NOW()
      WHERE id = $3 AND is_active = TRUE
      RETURNING id, label;
      `,
      [keyHash, keyPreview, id]
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({
        error: "API key not found or inactive"
      });
    }

    return reply.send({
      success: true,
      newApiKey: rawKey,
      preview: keyPreview,
      note: "Store this key securely. It will NOT be shown again."
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to rotate API key" });
  }
}
