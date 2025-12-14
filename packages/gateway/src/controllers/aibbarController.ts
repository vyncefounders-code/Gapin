import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/client';
import { EventPublisher } from '../events/publish';

interface AibbarEvent {
  event_type: string;
  ai_id?: string;
  ai_version?: string;
  timestamp: string;
  action?: any;
  decision?: any;
  error?: any;
  metadata?: any;
  signature?: string;
}

export function buildAibbarController(eventPublisher: EventPublisher) {
  return {
    /**
     * Handle incoming AIBBAR events:
     * 1. Validate schema
     * 2. Verify signature
     * 3. Normalize + persist to DB
     * 4. Publish to Kafka
     */
    async ingestAibbarEvent(request: FastifyRequest, reply: FastifyReply) {
      const fastify = request.server;

      const skipInfra = process.env.SKIP_INFRA === 'true';

      // 1. Validate schema
      const schemaErr = await fastify.validateEvent(request, reply);
      if (schemaErr) return schemaErr;

      // 2. Verify signature (mandatory in production)
      if (process.env.AIBBAR_SECRET && !skipInfra) {
        const sigErr = await fastify.verifySignature(request, reply);
        if (sigErr) return sigErr;
      }

      const body = request.body as AibbarEvent;

      const eventId = uuidv4();

      const storedPayload = {
        event_id: eventId,
        ...body,
        received_at: new Date().toISOString(),
      };

      try {
        if (!skipInfra) {
          //
          // 3. Persist to database
          //
          await pool.query(
            `
            INSERT INTO aibbar_events (
              event_id,
              event_type,
              ai_id,
              ai_version,
              payload,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, NOW())
            `,
            [
              eventId,
              body.event_type,
              body.ai_id ?? null,
              body.ai_version ?? null,
              JSON.stringify(storedPayload),
            ]
          );

          //
          // 4. Publish to Kafka
          //
          await eventPublisher.publish('aibbar.events', storedPayload);

          fastify.log.info({ eventId }, 'AIBBAR event stored and published');
        } else {
          fastify.log.info(
            { eventId },
            '[DEV] AIBBAR event received (SKIP_INFRA enabled)'
          );
        }

        return reply.send({
          success: true,
          eventId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fastify.log.error({ err: msg }, 'Failed to process AIBBAR event');

        return reply.code(500).send({
          success: false,
          error: 'Failed to process AIBBAR event',
          details: msg,
        });
      }
    },
  };
}
