import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import Ajv from 'ajv';

declare module 'fastify' {
  interface FastifyInstance {
    validateEvent: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
  }
}

const ajv = new Ajv({ allErrors: true, coerceTypes: true });

// Strict AIBBAR event schema: require core fields and disallow unknown props
const eventSchema = {
  type: 'object',
  properties: {
    event_type: { type: 'string' },
    ai_id: { type: 'string' },
    ai_version: { type: 'string' },
    action: { type: 'object' },
    timestamp: { type: 'string' },
    signature: { type: 'string' },
    metadata: { type: 'object' }
  },
  required: ['event_type', 'timestamp', 'action'],
  additionalProperties: false
};

const validate = ajv.compile(eventSchema);

const eventValidator: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('validateEvent', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const valid = validate(body);
    if (!valid) {
      const errors = validate.errors;
      fastify.log.warn({ errors }, 'Event payload failed schema validation');
      return reply.code(400).send({ error: 'Event payload validation failed', details: errors });
    }
  });
};

export default eventValidator;
