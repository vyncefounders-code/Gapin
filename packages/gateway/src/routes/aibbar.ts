import { FastifyPluginAsync } from "fastify";
import { verifyEventSignature } from "../utils/signer";
import { validateAibbarEvent } from "../validators/aibbarValidators";
import pool from "../db/client";
import { randomUUID } from "crypto";
import { normalizeAibbarEvent } from "../utils/normalizer";

export const aibbarRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.post("/aibbar/events", async (request, reply) => {
    const event = request.body as any;

    //
    // 1. VALIDATE SCHEMA
    //
    const valid = validateAibbarEvent(event);
    if (!valid) {
      return reply.code(400).send({
        error: "Invalid AIBBAR event",
        details: (validateAibbarEvent as any).errors || []
      });
    }

    //
    // 2. VERIFY SIGNATURE
    //
    const secret = process.env.AIBBAR_SIGNING_SECRET;
    if (!secret) {
      fastify.log.error("AIBBAR_SIGNING_SECRET missing");
      return reply.code(500).send({ error: "Server missing signing secret" });
    }

    const ok = verifyEventSignature(event, event.signature, secret);
    if (!ok) {
      return reply.code(401).send({ error: "Signature verification failed" });
    }

    //
    // 3. NORMALIZE EVENT
    //
    const normalized = normalizeAibbarEvent(event);

    // Assign server-side event ID
    const eventId = randomUUID();
    normalized.eventId = eventId;

    //
    // 4. STORE IN DATABASE
    //
    try {
      await pool.query(
        `INSERT INTO aibbar_events (id, ai_id, event_type, payload, signature, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          eventId,
          normalized.ai_id,
          normalized.event_type,
          JSON.stringify(normalized),
          normalized.signature
        ]
      );
    } catch (err) {
      fastify.log.error({ err }, "Failed DB insert");
      return reply.code(500).send({ error: "Database insert failed" });
    }

    //
    // 5. PUBLISH TO KAFKA
    //
    const skipInfra = process.env.SKIP_INFRA === "true";

    if (!skipInfra) {
      if (!("kafkaProducer" in fastify)) {
        fastify.log.error("Kafka producer missing on Fastify instance");
        return reply.code(500).send({ error: "Kafka not available" });
      }

      try {
        await (fastify as any).kafkaProducer.send({
          topic: "aibbar.events",
          messages: [
            {
              key: normalized.ai_id,
              value: JSON.stringify(normalized)
            }
          ]
        });
      } catch (err) {
        fastify.log.error({ err }, "Kafka publish failed");
        return reply.code(500).send({ error: "Kafka publish failed" });
      }
    }

    //
    // 6. RESPONSE
    //
    return reply.send({
      success: true,
      eventId,
      normalized: true
    });
  });
};
