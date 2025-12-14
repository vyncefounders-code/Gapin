import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Kafka } from 'kafkajs';
import pool from './db/client';
import healthRoutes from './routes/health';
import userRoutes from './routes/user';
import authRoutes from './routes/auth';
import keyRoutes from './routes/key';
import { EventPublisher } from './events/publish';
import { EventConsumer } from './events/consume';
import apiKeyAuth from './plugins/apiKeyAuth';

const fastify = Fastify({ logger: true });

// Register plugins
fastify.register(apiKeyAuth);

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

  // Publish Event (protected)
  instance.post(
    '/events/publish',
    { preHandler: instance.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { topic, message } = request.body as { topic: string; message: any };

      // Validate input
      const validation = validateEventPayload(topic, message);
      if (!validation.valid) {
        instance.log.warn({ topic, message, error: validation.error }, 'Invalid event payload');
        return reply.code(400).send({ error: validation.error });
      }

      try {
        const eventId = uuidv4();
        const eventData = {
          ...message,
          eventId,
          timestamp: new Date().toISOString(),
        };

        // Publish to Kafka
        const result = await eventPublisher.publish(topic, eventData);

        // Store to database (await and log on error)
        try {
          await pool.query(
            'INSERT INTO events (topic, message, created_at) VALUES ($1, $2, NOW())',
            [topic, JSON.stringify(eventData)]
          );
        } catch (dbErr) {
          instance.log.warn({ eventId, topic, err: dbErr }, 'Failed to store event in database');
        }

        instance.log.info({ eventId }, `Event published to ${topic}`);
        return { ...result, eventId };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        instance.log.error({ topic, error: errorMsg }, 'Failed to publish event');
        return reply.code(500).send({ error: 'Failed to publish event' });
      }
    }
  );

  // Read Events (protected)
  instance.get(
    '/events/read',
    { preHandler: instance.authenticate },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await pool.query('SELECT * FROM events ORDER BY created_at DESC LIMIT 10');
        return { events: result.rows };
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
  try {
    fastify.log.info('Starting GAPIN Gateway...');

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

    // Start Fastify server
    await fastify.listen({ port: parseInt(process.env.PORT || '3000'), host: '0.0.0.0' });
    fastify.log.info('Gateway started');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
*** End Patch
// Public route
fastify.register(healthRoutes);

// -----------------------
// 🔐 PROTECTED ROUTES
// -----------------------

// Publish Event
fastify.post(
  "/events/publish",
  { preHandler: fastify.authenticate },
  async (request, reply) => {
    const { topic, message } = request.body as {
      topic: string;
      message: any;
    };

    try {
      const result = await eventPublisher.publish(topic, message);
      return { ...result, eventId: uuidv4() };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "Failed to publish event" });
    }
>>>>>>> 9dcd0ad (Add full monorepo setup: gateway endpoints, SDK clients, DB init, demos, and env config)
  }
);

<<<<<<< HEAD
// Read events from DB with table validation
fastify.get('/events/read', async (_: FastifyRequest, reply: FastifyReply) => {
  try {
    const result = await pool.query(
      'SELECT * FROM events ORDER BY created_at DESC LIMIT 10'
    );
    return { events: result.rows };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    fastify.log.error({ error: errorMsg }, 'Failed to read events');
    
    if (errorMsg.includes('does not exist')) {
      return reply.code(503).send({ error: 'Events table not initialized. Run db:init script.' });
    }
    return reply.code(500).send({ error: 'Failed to read events' });
=======
// Read Events
fastify.get(
  "/events/read",
  { preHandler: fastify.authenticate },
  async (_, reply) => {
    try {
      const result = await pool.query(
        "SELECT * FROM events ORDER BY created_at DESC LIMIT 10"
      );
      return { events: result.rows };
    } catch (err) {
      return reply.code(500).send({ error: "Failed to read events" });
    }
>>>>>>> 9dcd0ad (Add full monorepo setup: gateway endpoints, SDK clients, DB init, demos, and env config)
  }
);

// -----------------------
// Startup Logic
// -----------------------

<<<<<<< HEAD
// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, starting graceful shutdown...`);
  try {
    await fastify.close();
    fastify.log.info('Fastify closed');

    await producer.disconnect();
    fastify.log.info('Kafka producer disconnected');

    await consumer.disconnect();
    fastify.log.info('Kafka consumer disconnected');

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
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    fastify.log.info('Database connected');

    // Connect producer
=======
const start = async () => {
  try {
    fastify.log.info("Starting GAPIN Gateway...");

    // Test DB connection
    await pool.query("SELECT NOW()");
    fastify.log.info("PostgreSQL connected");

    // Connect Producer
>>>>>>> 9dcd0ad (Add full monorepo setup: gateway endpoints, SDK clients, DB init, demos, and env config)
    await producer.connect();
    fastify.log.info("Kafka Producer connected");

    // Connect Consumer
    await consumer.connect();
    fastify.log.info("Kafka Consumer connected");

<<<<<<< HEAD
    // Subscribe to topics (done once at startup, not per call)
    await eventConsumer.subscribeToTopics(['test-topic']);
    eventConsumer.startConsuming((msg) => {
      fastify.log.info(`Received message: ${JSON.stringify(msg)}`);
    });

    // Start Fastify server
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    fastify.log.info('Gateway started on http://0.0.0.0:3000');
  } catch (err) {
    const startError = err instanceof Error ? err.message : String(err);
    fastify.log.error({ error: startError }, 'Failed to start gateway');
=======
    // Subscribe to topics if needed
    eventConsumer.consume("test-topic", (msg) => {
      fastify.log.info(
        `Received message on test-topic: ${JSON.stringify(msg)}`
      );
    });

    // Start Fastify
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    fastify.log.info("Gateway running on http://localhost:3000");
  } catch (error) {
    fastify.log.error(error);
>>>>>>> 9dcd0ad (Add full monorepo setup: gateway endpoints, SDK clients, DB init, demos, and env config)
    process.exit(1);
  }
};

start();
