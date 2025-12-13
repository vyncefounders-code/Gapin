import { FastifyInstance } from 'fastify';
import { createUser, getUser, getAllUsers } from '../controllers/userController';

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.post('/users', createUser);
  fastify.get('/users/:id', getUser);
  fastify.get('/users', getAllUsers);
}
