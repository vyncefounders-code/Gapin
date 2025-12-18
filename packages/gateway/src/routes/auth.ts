import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import pool from "../db/client";
import jwt from "jsonwebtoken";

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

  /* ---------------- REGISTER ---------------- */
  fastify.post(
    "/auth/register",
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply) => {
      const { email, password, name } = request.body;

      try {
        const existing = await pool.query(
          "SELECT id FROM users WHERE email = $1",
          [email]
        );

        if (existing.rowCount) {
          return reply.code(400).send({ error: "User already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
          `INSERT INTO users (email, password_hash, name)
           VALUES ($1, $2, $3)
           RETURNING id, email, name, created_at`,
          [email, passwordHash, name || null]
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

  /* ---------------- LOGIN ---------------- */
  fastify.post(
    "/auth/login",
    async (request: FastifyRequest<{ Body: LoginBody }>, reply) => {
      const { email, password } = request.body;

      try {
        const result = await pool.query(
          `SELECT id, email, name, password_hash
           FROM users WHERE email = $1`,
          [email]
        );

        if (!result.rowCount) {
          return reply.code(401).send({ error: "Invalid credentials" });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);

        if (!valid) {
          return reply.code(401).send({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
          { id: user.id, email: user.email },
          process.env.JWT_SECRET || "dev-secret",
          { expiresIn: "7d" }
        );

        return reply.send({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: "Login failed" });
      }
    }
  );

  /* ---------------- ME ---------------- */
  fastify.get(
    "/auth/me",
    { preHandler: (fastify as any).authenticateUser },
    async (request, reply) => {
      return reply.send({
        success: true,
        user: (request as any).user
      });
    }
  );
}
