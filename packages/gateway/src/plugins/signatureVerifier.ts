import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

declare module 'fastify' {
  interface FastifyInstance {
    verifySignature: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
  }
}

const signatureVerifier: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('verifySignature', async (request: FastifyRequest, reply: FastifyReply) => {
    const secret = process.env.AIBBAR_SECRET;
    const sig = (request.headers['x-aibbar-signature'] as string) || '';

    if (!secret) {
      fastify.log.warn('AIBBAR_SECRET not set; skipping signature verification');
      return;
    }

    if (!sig) {
      return reply.code(401).send({ error: 'Missing x-aibbar-signature header' });
    }

    // compute HMAC over raw body if available, else JSON stringify message
    // Fastify does not expose raw body by default; expect SDK to sign JSON string of message
    const body = (request.body as any) || {};
    const payload = JSON.stringify(body);
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // constant time compare
    const hmacBuf = Buffer.from(hmac, 'hex');
    const sigBuf = Buffer.from(sig, 'hex');
    if (hmacBuf.length !== sigBuf.length || !crypto.timingSafeEqual(hmacBuf, sigBuf)) {
      return reply.code(401).send({ error: 'Invalid signature' });
    }
  });
};

export default signatureVerifier;
