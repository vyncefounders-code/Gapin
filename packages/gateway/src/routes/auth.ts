import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import pool from "../db/client";

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
      }
    },
    async (
      request: FastifyRequest<{ Body: RegisterBody }>,
      reply: FastifyReply
    ) => {
      const { email, password, name } = request.body;

      try {
        // Check if email already exists
        const existing = await pool.query(
          `SELECT id FROM users WHERE email = $1`,
          [email]
        );

        if (existing.rowCount > 0) {
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
      }
    },
    async (
      request: FastifyRequest<{ Body: LoginBody }>,
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

        // No JWT — session handled by NextAuth or dashboard API
        return reply.send({
          success: true,
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
    { preHandler: fastify.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const apiKeyInfo = (request as any).apiKey;

        return reply.send({
          success: true,
          account: apiKeyInfo
        });
      } catch (err) {
        request.log.error(err);
        reply.code(500).send({ error: "Failed to fetch profile" });
      }
    }
  );
}
