import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export const aibbarEventSchema = {
  type: "object",
  properties: {
    event_type: {
      type: "string",
      enum: ["ai.action", "ai.decision", "ai.error", "ai.query", "ai.response"],
    },
    ai_id: { type: "string", minLength: 10 },
    ai_version: { type: "string", minLength: 1 },
    timestamp: { type: "string", format: "date-time" },

    action: {
      type: "object",
      nullable: true,
      properties: {
        function: { type: "string" },
        input: {},
        output: {},
        latency_ms: { type: "number" },
        model: { type: "string" },
        tokens_used: { type: "number", nullable: true },
      },
    },

    decision: {
      type: "object",
      nullable: true,
      properties: {
        type: { type: "string" },
        logic: { type: "string" },
        options: { type: "array" },
        chosen: {},
        confidence: { type: "number" },
      },
    },

    error: {
      type: "object",
      nullable: true,
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        stack: { type: "string", nullable: true },
        recoverable: { type: "boolean" },
      },
    },

    metadata: {
      type: "object",
      nullable: true,
      properties: {
        user_id: { type: "string", nullable: true },
        session_id: { type: "string", nullable: true },
        request_id: { type: "string", nullable: true },
        source_ip: { type: "string", nullable: true },
        country: { type: "string", nullable: true },
        region: { type: "string", nullable: true },
      },
    },

    signature: { type: "string" },
    signature_algorithm: {
      type: "string",
      enum: ["HMAC-SHA256"],
    },
  },

  required: ["event_type", "ai_id", "ai_version", "timestamp", "signature"],

  additionalProperties: false,
};

const validate = ajv.compile(aibbarEventSchema);

export function validateAibbarEvent(event: any) {
  const valid = validate(event);
  (validateAibbarEvent as any).errors = validate.errors;
  return valid;
}
