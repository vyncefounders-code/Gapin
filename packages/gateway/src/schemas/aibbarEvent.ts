export const AIBBAR_EVENT_SCHEMA = {
  type: "object",
  required: ["event_type", "ai_id", "timestamp", "metadata"],
  additionalProperties: false,
  properties: {
    event_type: {
      type: "string",
      enum: ["ai.action", "ai.decision", "ai.error", "ai.query", "ai.response"]
    },

    ai_id: { type: "string" },
    ai_version: { type: "string" },

    timestamp: {
      type: "string",
      format: "date-time"
    },

    action: {
      type: "object",
      required: ["function"],
      properties: {
        function: { type: "string" },
        input: {},
        output: {},
        latency_ms: { type: "number" },
        model: { type: "string" },
        tokens_used: { type: "number" }
      }
    },

    decision: {
      type: "object",
      properties: {
        type: { type: "string" },
        logic: { type: "string" },
        options: {},
        chosen: {},
        confidence: { type: "number" }
      }
    },

    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        stack: { type: "string" },
        recoverable: { type: "boolean" }
      }
    },

    metadata: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        session_id: { type: "string" },
        request_id: { type: "string" },
        source_ip: { type: "string" },
        country: { type: "string" },
        region: { type: "string" }
      }
    },

    signature: { type: "string" },
    signature_algorithm: {
      type: "string",
      enum: ["HMAC-SHA256"]
    }
  }
};
