import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

declare module 'fastify' {
  interface FastifyInstance {
    verifySignature: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
  }
}

const signatureVerifier: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('verifySignature', async (request: FastifyRequest, reply: FastifyReply) => {
    const SKIP_INFRA = process.env.SKIP_INFRA === 'true';
    const secret = process.env.AIBBAR_SECRET;

    // Signature REQUIRED unless SKIP_INFRA=true
    if (!SKIP_INFRA && !secret) {
      fastify.log.error('AIBBAR_SECRET is missing. Signature verification cannot run.');
      return reply.code(500).send({ error: 'Server misconfiguration: signature secret missing' });
    }

    // If SKIP_INFRA: allow no signature
    if (SKIP_INFRA) return;

    const signature = request.headers['x-aibbar-signature'];
    if (!signature) {
      return reply.code(401).send({ error: 'Missing x-aibbar-signature header' });
    }

    const payload = JSON.stringify(request.body ?? {});
    const computed = crypto.createHmac('sha256', secret!).update(payload).digest('hex');

    const sigBuf = Buffer.from(signature as string, 'hex');
    const cmpBuf = Buffer.from(computed, 'hex');

    if (
      sigBuf.length !== cmpBuf.length ||
      !crypto.timingSafeEqual(sigBuf, cmpBuf)
    ) {
      fastify.log.warn('Invalid event signature received');
      return reply.code(401).send({ error: 'Invalid signature' });
    }
  });
};

export default signatureVerifier;
