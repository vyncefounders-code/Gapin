import Fastify from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Kafka } from 'kafkajs';
import pool from './db/client';

import healthRoutes from './routes/health';
import userRoutes from './routes/user';
import authRoutes from './routes/auth';
import apiKeysRoutes from './routes/apikeys';
import { aibbarRoutes } from './routes/aibbar';

import apiKeyAuth from './plugins/apiKeyAuth';
import apiKeyValidator from './plugins/apiKeyValidator';
import jwtAuth from './plugins/jwtAuth';
import eventValidator from './plugins/eventValidator';
import signatureVerifier from './plugins/signatureVerifier';

import { EventPublisher } from './events/publish';
import { EventConsumer } from './events/consume';

const fastify = Fastify({ logger: true });

/* -------------------- Plugins -------------------- */
fastify.register(apiKeyAuth);
fastify.register(apiKeyValidator);
fastify.register(jwtAuth);
fastify.register(eventValidator);
fastify.register(signatureVerifier);
fastify.register(aibbarRoutes);

/* -------------------- Routes -------------------- */
fastify.register(healthRoutes);
fastify.register(authRoutes);

fastify.register(async (instance) => {
  instance.register(userRoutes);
  instance.register(apiKeysRoutes);
});

/* -------------------- Infra Flags -------------------- */
const SKIP_INFRA =
  process.env.SKIP_INFRA === 'true' ||
  process.env.NODE_ENV === 'development';

/* -------------------- Kafka Setup -------------------- */
let producer: any = null;
let consumer: any = null;
let eventPublisher: EventPublisher | null = null;
let eventConsumer: EventConsumer | null = null;

if (!SKIP_INFRA) {
  const kafka = new Kafka({
    clientId: 'gapin-gateway',
    brokers: [process.env.KAFKA_BROKER || 'redpanda:9092'],
  });

  producer = kafka.producer();
  consumer = kafka.consumer({ groupId: 'gapin-group' });

  eventPublisher = new EventPublisher(producer);
  eventConsumer = new EventConsumer(consumer);

  fastify.decorate('kafkaProducer', producer);
} else {
  fastify.log.warn('SKIP_INFRA enabled — Kafka disabled');
}

/* -------------------- Graceful Shutdown -------------------- */
const shutdown = async () => {
  fastify.log.info('Shutting down gateway...');
  try {
    if (consumer) await consumer.disconnect();
    if (producer) await producer.disconnect();
    await pool.end();
    await fastify.close();
  } catch (err) {
    fastify.log.error(err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/* -------------------- Start Server -------------------- */
const start = async () => {
  try {
    fastify.log.info('Starting GAPIN Gateway...');

    if (!SKIP_INFRA) {
      await pool.query('SELECT 1');
      fastify.log.info('PostgreSQL connected');

      await producer.connect();
      fastify.log.info('Kafka producer connected');

      await consumer.connect();
      fastify.log.info('Kafka consumer connected');

      await eventConsumer!.subscribeToTopics([
        process.env.DEFAULT_TOPIC || 'aibbar.events',
      ]);

      await eventConsumer!.startConsuming((msg) => {
        fastify.log.info({ msg }, 'Kafka message received');
      });
    }

    await fastify.listen({
      port: Number(process.env.PORT || 3000),
      host: '0.0.0.0',
    });

    fastify.log.info('Gateway listening');
  } catch (err: any) {
    fastify.log.error(err);

    // ❗ DO NOT EXIT IN DEV
    if (!SKIP_INFRA) {
      fastify.log.error('Infra failed — exiting');
      process.exit(1);
    }

    fastify.log.warn('Infra failed but SKIP_INFRA=true — continuing');
  }
};

start();
