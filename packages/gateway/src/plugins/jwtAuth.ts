import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import pool from '../db/client';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

const jwtAuth: FastifyPluginAsync = async (fastify) => {
  // Generate a JWT for a given user payload
  fastify.decorate('generateJwt', (payload: object) => {
    return (jwt as any).sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  });

  // Authenticate user by verifying JWT and attaching user to request
  fastify.decorate('authenticateUser', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
    }

    const token = auth.replace('Bearer ', '').trim();
    try {
      const decoded = (jwt as any).verify(token, JWT_SECRET) as any;
      const userId = decoded?.sub || decoded?.id;
      if (!userId) {
        return reply.code(401).send({ error: 'Invalid token payload' });
      }

      // Fetch user from DB to attach fresh info
      const res = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [userId]);
      if (res.rowCount === 0) return reply.code(401).send({ error: 'User not found' });

      (request as any).user = res.rows[0];
      return;
    } catch (err) {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });
};

export default jwtAuth;
