import { FastifyPluginAsync } from 'fastify';
import jwt from 'jsonwebtoken';
import pool from '../db/client';

const jwtAuth: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    'authenticateUser',
    async (request: any, reply: any) => {
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          return reply.code(401).send({ error: 'Missing token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const secret = process.env.JWT_SECRET!;
        const decoded: any = jwt.verify(token, secret);

        const result = await pool.query(
          `SELECT id, email, name, created_at FROM users WHERE id = $1`,
          [decoded.id]
        );

        if (result.rowCount === 0) {
          return reply.code(401).send({ error: 'User not found' });
        }

        request.user = result.rows[0];
      } catch (err) {
        return reply.code(401).send({ error: 'Invalid token' });
      }
    }
  );
};

export default jwtAuth;
