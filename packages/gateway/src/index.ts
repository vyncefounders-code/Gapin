import Fastify from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
import { Kafka } from 'kafkajs'; // Assuming Redpanda is Kafka-compatible

const fastify = Fastify({ logger: true });

// Database connection
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gapin',
  user: process.env.DB_USER || 'gapin',
  password: process.env.DB_PASSWORD || 'gapin123',
});

// Kafka client for Redpanda
const kafka = new Kafka({
  clientId: 'gapin-gateway',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});
const producer = kafka.producer();

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Event publish endpoint
fastify.post('/events/publish', async (request, reply) => {
  const { topic, message } = request.body as { topic: string; message: any };
  try {
    await producer.connect();
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
    return { success: true, eventId: uuidv4() };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to publish event' });
  }
});

// Event read endpoint (simplified, reads from DB if stored)
fastify.get('/events/read', async (request, reply) => {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY created_at DESC LIMIT 10');
    return { events: result.rows };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to read events' });
  }
});

// Declare a route
fastify.get('/', async (request, reply) => {
  return { hello: 'world', id: uuidv4() };
});

// Run the server!
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();