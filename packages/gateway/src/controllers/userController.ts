import { FastifyRequest, FastifyReply } from 'fastify';
import pool from '../db/client';

export const createUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { email, name } = request.body as { email: string; name: string };

  if (!email || !name) {
    return reply.code(400).send({ error: 'Email and name are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
      [email, name]
    );
    return { user: result.rows[0] };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    request.log.error({ error: errorMsg }, 'Failed to create user');
    return reply.code(500).send({ error: 'Failed to create user' });
  }
};

export const getUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'User not found' });
    }
    return { user: result.rows[0] };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    request.log.error({ error: errorMsg }, 'Failed to get user');
    return reply.code(500).send({ error: 'Failed to get user' });
  }
};

export const getAllUsers = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    return { users: result.rows };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    request.log.error({ error: errorMsg }, 'Failed to get users');
    return reply.code(500).send({ error: 'Failed to get users' });
  }
};
