import Fastify from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Kafka } from 'kafkajs';
import pool from './db/client';
import healthRoutes from './routes/health';
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

// Register health route
fastify.register(healthRoutes);

// Event publish endpoint
fastify.post('/events/publish', async (request, reply) => {
  const { topic, message } = request.body as { topic: string; message: any };

  try {
    const result = await eventPublisher.publish(topic, message);
    return { ...result, eventId: uuidv4() };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to publish event' });
  }
});

// Read events from DB
fastify.get('/events/read', async (_, reply) => {
  try {
    const result = await pool.query(
      'SELECT * FROM events ORDER BY created_at DESC LIMIT 10'
    );
    return { events: result.rows };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to read events' });
  }
});

// Basic route
fastify.get('/', async () => {
  return { hello: 'world', id: uuidv4() };
});

// Start server + connect Kafka + start consumer
const start = async () => {
  try {
    // Connect producer
    await producer.connect();
    fastify.log.info('Kafka Producer connected');

    // Connect consumer
    await consumer.connect();
    fastify.log.info('Kafka Consumer connected');

    // Example subscription (for debugging)
    eventConsumer.consume('test-topic', (msg) => {
      fastify.log.info(`Received message from test-topic: ${JSON.stringify(msg)}`);
    });

    // Start Fastify server
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();