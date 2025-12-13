<<<<<<< HEAD
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Kafka } from 'kafkajs';
import pool from './db/client';
import healthRoutes from './routes/health';
import userRoutes from './routes/user';
import { EventPublisher } from './events/publish';
import { EventConsumer } from './events/consume';
=======
import Fastify from "fastify";
import { v4 as uuidv4 } from "uuid";
import { Kafka } from "kafkajs";
import pool from "./db/client";
import healthRoutes from "./routes/health";
import { EventPublisher } from "./events/publish";
import { EventConsumer } from "./events/consume";


// 🔐 API Key Auth Plugin
import apiKeyAuth from "./plugins/apiKeyAuth";
>>>>>>> 9dcd0ad (Add full monorepo setup: gateway endpoints, SDK clients, DB init, demos, and env config)

const fastify = Fastify({ logger: true });

// In‑memory store for per‑key rate limiting
fastify.decorate("rateLimitMap", new Map());

// Register Auth Plugin
fastify.register(apiKeyAuth);

// Kafka Setup
const kafka = new Kafka({
  clientId: "gapin-gateway",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "gapin-group" });

const eventPublisher = new EventPublisher(producer);
const eventConsumer = new EventConsumer(consumer);

<<<<<<< HEAD
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

// Register health route with DB + Kafka validation
fastify.register(healthRoutes);

// Register user routes
fastify.register(userRoutes);

// Event publish endpoint with validation
fastify.post('/events/publish', async (request: FastifyRequest, reply: FastifyReply) => {
  const { topic, message } = request.body as { topic: string; message: any };

  // Validate input
  const validation = validateEventPayload(topic, message);
  if (!validation.valid) {
    fastify.log.warn({ topic, message, error: validation.error }, `Invalid event payload: ${validation.error}`);
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

    // Store to database (non-blocking, log if fails)
    pool
      .query(
        'INSERT INTO events (topic, message, created_at) VALUES ($1, $2, NOW())',
        [topic, JSON.stringify(eventData)]
      )
      .catch((err: any) => {
        fastify.log.warn(
          {
            eventId,
            topic,
            error: err instanceof Error ? err.message : String(err),
          },
          'Failed to store event in database'
        );
      });

    fastify.log.info({ eventId }, `Event published to ${topic}`);
    return { ...result, eventId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    fastify.log.error({ topic, error: errorMsg }, 'Failed to publish event');
    return reply.code(500).send({ error: 'Failed to publish event' });
=======
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
