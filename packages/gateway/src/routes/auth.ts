import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import pool from "../db/client";
import jwt from 'jsonwebtoken';
import limiter from '../lib/rateLimiter';

interface RegisterBody {
  email: string;
  password: string;
  name?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
  /* -------------------------------------------------------------
     1️⃣ REGISTER USER
  ------------------------------------------------------------- */
  fastify.post(
    "/auth/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string" },
            password: { type: "string" },
            name: { type: "string" }
          }
        }
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const ip = (request as any).ip || request.headers['x-forwarded-for'] || 'unknown';
        const WINDOW = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || '60');
        const LIMIT = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5');
        try {
          const res = await limiter.increment(`auth:register:${ip}`, WINDOW, LIMIT);
          reply.header('X-RateLimit-Limit', String(LIMIT));
          reply.header('X-RateLimit-Remaining', String(res.remaining));
          reply.header('X-RateLimit-Reset', String(res.reset));
          if (!res.allowed) return reply.code(429).send({ error: 'Rate limit exceeded' });
        } catch (e) {
          request.log.warn({ e }, 'Rate limiter failed for register');
        }
      }
    } as any,
    async (
      request: FastifyRequest<{ Body: RegisterBody }> ,
      reply: FastifyReply
    ) => {
      const { email, password, name } = request.body;

      try {
        // Check if email already exists
        const existing = await pool.query(
          `SELECT id FROM users WHERE email = $1`,
          [email]
        );

        if (existing.rowCount && existing.rowCount > 0) {
          return reply.code(400).send({
            error: "User already exists"
          });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
          `INSERT INTO users (email, password_hash, name)
           VALUES ($1, $2, $3)
           RETURNING id, email, name, created_at`,
          [email, hashedPassword, name || null]
        );

        return reply.send({
          success: true,
          user: result.rows[0]
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: "Registration failed" });
      }
    }
  );

  /* -------------------------------------------------------------
     2️⃣ LOGIN USER
  ------------------------------------------------------------- */
  fastify.post(
    "/auth/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string" },
            password: { type: "string" }
          }
        }
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const ip = (request as any).ip || request.headers['x-forwarded-for'] || 'unknown';
        const WINDOW = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || '60');
        const LIMIT = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10');
        try {
          const res = await limiter.increment(`auth:login:${ip}`, WINDOW, LIMIT);
          reply.header('X-RateLimit-Limit', String(LIMIT));
          reply.header('X-RateLimit-Remaining', String(res.remaining));
          reply.header('X-RateLimit-Reset', String(res.reset));
          if (!res.allowed) return reply.code(429).send({ error: 'Rate limit exceeded' });
        } catch (e) {
          request.log.warn({ e }, 'Rate limiter failed for login');
        }
      }
    } as any,
    async (
      request: FastifyRequest<{ Body: LoginBody }> ,
      reply: FastifyReply
    ) => {
      const { email, password } = request.body;

      try {
        const result = await pool.query(
          `SELECT id, email, name, password_hash
           FROM users WHERE email = $1`,
          [email]
        );

        if (result.rowCount === 0) {
          return reply.code(401).send({ error: "Invalid credentials" });
        }

        const user = result.rows[0];

        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
          return reply.code(401).send({ error: "Invalid credentials" });
        }

        // Sign JWT and return token + basic user info
        const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
        const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

        const token = (jwt as any).sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRY, subject: String(user.id) });

        return reply.send({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          },
          message: "Login successful"
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: "Login failed" });
      }
    }
  );

  /* -------------------------------------------------------------
     3️⃣ GET USER PROFILE (Protected)
  ------------------------------------------------------------- */
  fastify.get(
    "/auth/me",
    { preHandler: (fastify as any).authenticateUser },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        if (!user) return reply.code(401).send({ error: 'Not authenticated' });

        return reply.send({
          success: true,
          account: {
            id: user.id,
            email: user.email,
            name: user.name,
            created_at: user.created_at
          }
        });
      } catch (err) {
        request.log.error(err);
        reply.code(500).send({ error: "Failed to fetch profile" });
      }
    }
  );
}
