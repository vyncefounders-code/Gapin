import { FastifyInstance } from 'fastify';
import pool from '../db/client';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    const skipInfra = process.env.SKIP_INFRA === 'true' || process.env.NODE_ENV === 'test';

    if (skipInfra) {
      return {
        status: 'healthy',
        mode: 'skip-infra',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        deps: {
          database: 'skipped',
          kafka: 'skipped',
          redis: 'skipped',
        },
      };
    }

    try {
      // Database connectivity
      const dbCheck = await pool.query('SELECT NOW()');
      if (!dbCheck) {
        return reply.code(503).send({
          status: 'unhealthy',
          reason: 'Database unavailable',
          timestamp: new Date().toISOString(),
        });
      }

      // Check if events table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'events'
        );
      `);

      const eventsTableExists = tableCheck.rows[0]?.exists || false;

      return {
        status: 'healthy',
        mode: 'full',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        deps: {
          database: 'connected',
          kafka: 'unknown',
          redis: 'unknown',
        },
        events_table: eventsTableExists ? 'ready' : 'not_initialized',
      };
    } catch (error) {
      return reply.code(503).send({
        status: 'unhealthy',
        reason: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });
}
