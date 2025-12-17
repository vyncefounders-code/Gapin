import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import Ajv from "ajv";
import addFormats from "ajv-formats";

declare module "fastify" {
  interface FastifyInstance {
    validateEvent: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
  }
}

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  removeAdditional: "all"
});

addFormats(ajv);

const eventSchema = {
  type: "object",
  properties: {
    event_type: {
      type: "string",
      enum: [
        "ai.action",
        "ai.decision",
        "ai.error",
        "ai.query",
        "ai.response",
        "system.event"
      ]
    },

    ai_id: { type: "string" },
    ai_version: { type: "string" },

    action: {
      type: "object",
      properties: {
        function: { type: "string" },
        input: { type: ["object", "null"] },
        output: { type: ["object", "null"] },
        latency_ms: { type: "number" },
        model: { type: "string" },
        tokens_used: { type: "number" }
      },
      required: ["function"],
      additionalProperties: false
    },

    decision: {
      type: "object",
      properties: {
        type: { type: "string" },
        logic: { type: "string" },
        options: { type: "array" },
        chosen: {},
        confidence: { type: "number" }
      },
      required: ["type"],
      additionalProperties: false
    },

    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        stack: { type: "string" },
        recoverable: { type: "boolean" }
      },
      required: ["code", "message"],
      additionalProperties: false
    },

    timestamp: { type: "string", format: "date-time" },

    signature: { type: "string" },

    metadata: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        session_id: { type: "string" },
        request_id: { type: "string" },
        source_ip: { type: "string" },
        country: { type: "string" },
        region: { type: "string" }
      },
      additionalProperties: false
    }
  },

  required: ["event_type", "timestamp", "signature"],
  additionalProperties: false
};

const validate = ajv.compile(eventSchema);

const eventValidator: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    "validateEvent",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as any;

      const valid = validate(body);

      if (!valid) {
        return reply.code(400).send({
          error: "Invalid event payload",
          details: validate.errors
        });
      }

      //
      // TIMESTAMP CHECK (FIXED TYPE ERROR)
      //
      const timestampStr = String(body.timestamp);
      const eventTime = new Date(timestampStr).getTime();
      const now = Date.now();

      if (isNaN(eventTime)) {
        return reply.code(400).send({ error: "Invalid timestamp format" });
      }

      if (eventTime > now + 5000) {
        return reply.code(400).send({ error: "Timestamp cannot be in the future" });
      }

      if (now - eventTime > 24 * 60 * 60 * 1000) {
        return reply.code(400).send({ error: "Timestamp is older than 24 hours" });
      }
    }
  );
};

export default eventValidator;
