import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Kafka } from 'kafkajs';
import pool from './db/client';
import healthRoutes from './routes/health';
import userRoutes from './routes/user';
import { EventPublisher } from './events/publish';
import { EventConsumer } from './events/consume';

const fastify = Fastify({ logger: true });

// Kafka client for Redpanda
const kafka = new Kafka({
  clientId: 'gapin-gateway',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

// Initialize producer + consumer
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
  }
});

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
  }
});

// Basic route
fastify.get('/', async () => {
  return { hello: 'world', id: uuidv4() };
});

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
    await producer.connect();
    fastify.log.info('Kafka Producer connected');

    // Connect consumer
    await consumer.connect();
    fastify.log.info('Kafka Consumer connected');

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
    process.exit(1);
  }
};

start();