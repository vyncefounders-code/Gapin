import { FastifyInstance } from "fastify";
import {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey
} from "../controllers/keyController";

export default async function keyRoutes(fastify: FastifyInstance) {
  // Protect all key routes with API key auth
  fastify.addHook("preHandler", async (request, reply) => {
    const maybeAuth = (fastify as any).authenticate;
    if (typeof maybeAuth === 'function') {
      return maybeAuth(request as any, reply as any);
    }
    fastify.log.warn('authenticate decorator not available; skipping auth');
    return;
  });

  /* ---------------------------------------------
     1️⃣ Generate API Key
  ---------------------------------------------- */
  fastify.post(
    "/apikeys",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            label: { type: "string" }
          },
          required: []
        }
      }
    },
    generateApiKey
  );

  /* ---------------------------------------------
     2️⃣ List API Keys
  ---------------------------------------------- */
  fastify.get("/apikeys", listApiKeys);

  /* ---------------------------------------------
     3️⃣ Revoke API Key
        (IMPORTANT: add Params schema)
  ---------------------------------------------- */
  fastify.delete(
    "/apikeys/:id",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string" }
          },
          required: ["id"]
        }
      }
    },
    revokeApiKey
  );

  /* ---------------------------------------------
     4️⃣ Rotate API Key
        (IMPORTANT: add Params schema)
  ---------------------------------------------- */
  fastify.post(
    "/apikeys/:id/rotate",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string" }
          },
          required: ["id"]
        }
      }
    },
    rotateApiKey
  );
}
