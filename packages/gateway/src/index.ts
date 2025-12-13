import Fastify from 'fastify';
import { v4 as uuidv4 } from 'uuid';

const fastify = Fastify({ logger: true });

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