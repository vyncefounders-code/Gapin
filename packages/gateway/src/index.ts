import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Kafka } from 'kafkajs';
import pool from './db/client';
import healthRoutes from './routes/health';
import userRoutes from './routes/user';
import authRoutes from './routes/auth';
import keyRoutes from './routes/key';
import apiKeysRoutes from './routes/apikeys';
import { EventPublisher } from './events/publish';
import { EventConsumer } from './events/consume';
import apiKeyAuth from './plugins/apiKeyAuth';
import apiKeyValidator from './plugins/apiKeyValidator';
import jwtAuth from './plugins/jwtAuth';
import eventValidator from './plugins/eventValidator';
import signatureVerifier from './plugins/signatureVerifier';

const fastify = Fastify({ logger: true });

// Register plugins
fastify.register(apiKeyAuth);
fastify.register(apiKeyValidator);
fastify.register(jwtAuth);
fastify.register(eventValidator);
fastify.register(signatureVerifier);

// Kafka Setup
const kafka = new Kafka({
  clientId: 'gapin-gateway',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'gapin-group' });

const eventPublisher = new EventPublisher(producer);
const eventConsumer = new EventConsumer(consumer);

// Validation helper
const validateEventPayload = (topic: string, message: any): { valid: boolean; error?: string } => {
  if (!topic || typeof topic !== 'string' || topic.trim() === '') {
    return { valid: false, error: 'Topic must be a non-empty string' };
  }
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Message must be a valid JSON object' };
  }
  return { valid: true };
};

// Public routes
fastify.register(healthRoutes);
fastify.register(authRoutes);

// Protected routes (register inside a scoped decorator so plugin hooks are available)
fastify.register(async (instance) => {
  instance.register(keyRoutes);
  instance.register(userRoutes);
  instance.register(apiKeysRoutes);

  // Publish Event (production version with API key auth)
  instance.post(
    '/events/publish',
    { preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        if (typeof (instance as any).validateApiKey === 'function') {
          return (instance as any).validateApiKey(request as any, reply as any);
        }
        instance.log.warn('validateApiKey decorator not available; skipping auth');
        return;
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const apiKey = (request as any).apiKey;
      if (!apiKey) {
        return reply.code(401).send({ error: 'API key required' });
      }

      const { topic, message } = request.body as { topic: string; message: any };

      // Validate input
      const validation = validateEventPayload(topic, message);
      if (!validation.valid) {
        instance.log.warn({ topic, message, error: validation.error }, 'Invalid event payload');
        return reply.code(400).send({ error: validation.error });
      }

      // Validate event schema (AIBBAR events)
      const schemaRes = await instance.validateEvent(request, reply);
      if (schemaRes) return schemaRes;

      // Optional: verify signature if provided
      if (process.env.AIBBAR_SECRET) {
        const sigRes = await instance.verifySignature(request, reply);
        if (sigRes) return sigRes;
      }

      try {
        const eventId = uuidv4();
        const eventData = {
          ...message,
          eventId,
          timestamp: new Date().toISOString(),
        };

        // Publish to Kafka and persist to DB (skip in dev mode)
        const skipInfra = process.env.SKIP_INFRA === 'true';
        if (!skipInfra) {
          // Publish to Kafka with topic prefixed by user_id
          const kafkaTopic = `events.${apiKey.user_id}.${topic}`;
          await eventPublisher.publish(kafkaTopic, eventData);

          // Store to database with user_id and key_id
          try {
            await pool.query(
              `INSERT INTO events (user_id, key_id, topic, message, created_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [apiKey.user_id, apiKey.id, topic, JSON.stringify(eventData)]
            );
          } catch (dbErr) {
            instance.log.warn({ eventId, topic, err: dbErr }, 'Failed to store event in database');
          }

          instance.log.info({ eventId, user_id: apiKey.user_id, key_id: apiKey.id }, `Event published to ${topic}`);
          return { success: true, eventId, topic, message: 'Event published' };
        } else {
          // Dev mode: return mock success response
          instance.log.info({ eventId }, `[DEV] Event would be published to events.${apiKey.user_id}.${topic}`);
          return { success: true, eventId, topic, message: 'Dev mode: event not persisted' };
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        instance.log.error({ topic, error: errorMsg }, 'Failed to publish event');
        return reply.code(500).send({ error: 'Failed to publish event' });
      }
    }
  );

  // Read Events (production version with API key auth)
  instance.get(
    '/events/read',
    { preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        if (typeof (instance as any).validateApiKey === 'function') {
          return (instance as any).validateApiKey(request as any, reply as any);
        }
        instance.log.warn('validateApiKey decorator not available; skipping auth');
        return;
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const apiKey = (request as any).apiKey;
      if (!apiKey) {
        return reply.code(401).send({ error: 'API key required' });
      }

      try {
        const skipInfra = process.env.SKIP_INFRA === 'true';
        if (skipInfra) {
          instance.log.info('[DEV] Returning mock events (database not connected)');
          return { 
            events: [], 
            message: 'Dev mode: no database connected' 
          };
        }

        // Parse optional query params
        const topic = (request.query as any).topic || null;
        const since = (request.query as any).since || null;
        const limit = parseInt((request.query as any).limit || '100');

        // Build query: events for this user
        let query = `SELECT id, topic, message, key_id, created_at FROM events WHERE user_id = $1`;
        const params: any[] = [apiKey.user_id];

        if (topic) {
          params.push(topic);
          query += ` AND topic = $${params.length}`;
        }

        if (since) {
          params.push(since);
          query += ` AND created_at > $${params.length}`;
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(query, params);

        return {
          success: true,
          count: result.rows.length,
          events: result.rows
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        instance.log.error({ error: errorMsg }, 'Failed to read events');
        if (errorMsg.includes('does not exist')) {
          return reply.code(503).send({ error: 'Events table not initialized. Run db:init script.' });
        }
        return reply.code(500).send({ error: 'Failed to read events' });
      }
    }
  );
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, starting graceful shutdown...`);
  try {
    // Stop consumer
    try {
      await eventConsumer.stop();
      fastify.log.info('Event consumer stopped');
    } catch (e) {
      fastify.log.warn({ err: e }, 'Error stopping consumer');
    }

    await fastify.close();
    fastify.log.info('Fastify closed');

    try {
      await producer.disconnect();
      fastify.log.info('Kafka producer disconnected');
    } catch (e) {
      fastify.log.warn({ err: e }, 'Error disconnecting producer');
    }

    try {
      await consumer.disconnect();
      fastify.log.info('Kafka consumer disconnected');
    } catch (e) {
      fastify.log.warn({ err: e }, 'Error disconnecting consumer');
    }

    await pool.end();
    fastify.log.info('Database pool closed');

    process.exit(0);
  } catch (err) {
    const shutdownError = err instanceof Error ? err.message : String(err);
    fastify.log.error({ error: shutdownError }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server + connect Kafka + start consumer
const start = async () => {
  const skipInfra = process.env.SKIP_INFRA === 'true' || process.env.NODE_ENV === 'test';
  try {
    fastify.log.info('Starting GAPIN Gateway...');

    if (!skipInfra) {
      // Test DB connection
      await pool.query('SELECT NOW()');
      fastify.log.info('PostgreSQL connected');

      // Connect Producer
      await producer.connect();
      fastify.log.info('Kafka Producer connected');

      // Connect Consumer
      await consumer.connect();
      fastify.log.info('Kafka Consumer connected');

      // Subscribe to topics (example 'aibbar.events')
      await eventConsumer.subscribeToTopics([process.env.DEFAULT_TOPIC || 'test-topic']);
      await eventConsumer.startConsuming((msg) => {
        fastify.log.info({ msg }, 'Received message');
      });
    } else {
      fastify.log.warn('SKIP_INFRA enabled: skipping DB/Kafka/Redis connections');
    }

    // Start Fastify server
    await fastify.listen({ port: parseInt(process.env.PORT || '3000'), host: '0.0.0.0' });
    fastify.log.info('Gateway started');
  } catch (err) {
    // Classify error
    const isInfraError = (err as any)?.code === 'ECONNREFUSED' || (err as any)?.aggregateErrors;
    const isPortError = (err as any)?.code === 'EADDRINUSE';
    
    fastify.log.error(err);
    
    // Always exit on port conflict (can't start server)
    if (isPortError) {
      const port = process.env.PORT || '3000';
      fastify.log.error(`Port ${port} already in use. Kill existing process or use different PORT.`);
      process.exit(1);
    }
    
    // Exit on infra errors only if NOT in skip mode
    if (!skipInfra && isInfraError) {
      fastify.log.error('Critical infrastructure connection failed - exiting');
      process.exit(1);
    }
    
    // If skipInfra true and infra failed, we've already logged; server started above
    if (skipInfra && isInfraError) {
      fastify.log.warn('Infrastructure error in SKIP_INFRA mode - continuing with dev server');
      return;
    }
    
    // Unknown error in skip mode - still exit (shouldn't happen)
    if (skipInfra) {
      fastify.log.error('Unexpected error in SKIP_INFRA mode');
      process.exit(1);
    }
  }
};

start();
