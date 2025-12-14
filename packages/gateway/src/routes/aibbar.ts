import { FastifyPluginAsync } from "fastify";
import { verifySignature } from "../utils/signer";
import { validateAibbarEvent } from "../validators/aibbarValidator";
import pool from "../db/client";
import { randomUUID } from "crypto";
import { normalizeEvent } from "../utils/normalizer";

export const aibbarRoutes: FastifyPluginAsync = async (fastify) => {
  
  fastify.post("/aibbar/events", async (request, reply) => {
    const event = request.body as any;

    // 1. SCHEMA VALIDATION
    const valid = validateAibbarEvent(event);
    if (!valid) {
      return reply.code(400).send({
        error: "Invalid AIBBAR event",
        details: validateAibbarEvent.errors,
      });
    }

    // 2. SIGNATURE VERIFICATION
    const secret = process.env.AIBBAR_SIGNING_SECRET;

    if (!secret) {
      fastify.log.warn("AIBBAR_SIGNING_SECRET missing — event signature cannot be verified");
      return reply.code(500).send({ error: "Server misconfigured: missing signing secret" });
    }

    const ok = verifySignature(event, event.signature, secret);
    if (!ok) {
      return reply.code(401).send({ error: "Signature verification failed" });
    }

    // 3. NORMALIZE EVENT (IMPORTANT PART OF TASK 5)
    const normalized = normalizeEvent(event);

    // Assign server-side event ID
    const eventId = randomUUID();
    normalized.eventId = eventId;

    // 4. STORE NORMALIZED EVENT IN DB
    try {
      await pool.query(
        `INSERT INTO aibbar_events (id, ai_id, event_type, payload, signature, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [eventId, normalized.ai_id, normalized.event_type, JSON.stringify(normalized), normalized.signature]
      );
    } catch (dbError) {
      fastify.log.error({ err: dbError }, "Failed to insert AIBBAR event into database");
      return reply.code(500).send({ error: "Failed to store event in database" });
    }

    // 5. PUBLISH TO KAFKA
    const skipInfra = process.env.SKIP_INFRA === "true";

    if (!skipInfra) {
      try {
        if (!fastify.kafkaProducer) {
          fastify.log.error("Kafka producer not available on Fastify instance");
          return reply.code(500).send({ error: "Kafka not initialized" });
        }

        await fastify.kafkaProducer.send({
          topic: "aibbar.events",
          messages: [
            {
              key: normalized.ai_id,
              value: JSON.stringify(normalized),
            },
          ],
        });

      } catch (kafkaError) {
        fastify.log.error({ err: kafkaError }, "Failed to publish AIBBAR event to Kafka");
        return reply.code(500).send({ error: "Failed to publish event to Kafka" });
      }
    } else {
      fastify.log.info("[DEV] SKIP_INFRA=true — Kafka publish skipped");
    }

    // 6. RESPONSE
    return reply.send({
      success: true,
      eventId,
      normalized: true
    });
  });
};
