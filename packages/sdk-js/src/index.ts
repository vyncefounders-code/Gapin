import axios from "axios";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { normalizeSdkEvent } from "./normalizer";

/* ----------------------------------------------------------
 * Types
 * ---------------------------------------------------------- */

export interface EventMessage {
  [key: string]: any;
}

export interface EventResponse {
  success: boolean;
  eventId?: string;
  topic?: string;
  error?: string;
}

export interface ClientOptions {
  baseUrl?: string;
  apiKey?: string;
  signingSecret?: string;
}

/* ----------------------------------------------------------
 * Utility Functions
 * ---------------------------------------------------------- */

export const generateId = (): string => uuidv4();

/**
 * Deep canonical JSON stringify.
 * Ensures deterministic signatures matching gateway validation.
 */
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    return `[${obj.map((item) => stableStringify(item)).join(",")}]`;
  }

  const sortedKeys = Object.keys(obj).sort();
  const parts = sortedKeys.map(
    (key) => `"${key}":${stableStringify(obj[key])}`
  );
  return `{${parts.join(",")}}`;
}

/**
 * Create HMAC-SHA256 signature using canonical JSON.
 */
export function signPayload(payload: any, secret: string): string {
  const canonical = stableStringify(payload);
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex");
}

/* ----------------------------------------------------------
 * Client
 * ---------------------------------------------------------- */

export class Client {
  private baseUrl: string;
  private apiKey?: string;
  private signingSecret?: string;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://localhost:3000";
    this.apiKey = options.apiKey;
    this.signingSecret = options.signingSecret;
  }

  /** GAPIN /health */
  async healthCheck(): Promise<any> {
    try {
      const res = await axios.get(`${this.baseUrl}/health`);
      return res.data;
    } catch (err) {
      throw new Error(`Health check failed: ${(err as Error).message}`);
    }
  }

  /* ----------------------------------------------------------
   * Publish Event (NORMALIZED + SIGNED)
   * ---------------------------------------------------------- */

  async publishEvent(topic: string, message: EventMessage): Promise<EventResponse> {
    if (!this.apiKey) {
      throw new Error("Missing API key. Provide { apiKey } when creating the Client.");
    }

    if (!this.signingSecret) {
      throw new Error("Missing signing secret. Provide { signingSecret }.");
    }

    /** Step 1 — Normalize BEFORE sending */
    const normalized = normalizeSdkEvent(message);

    /** Step 2 — Build canonical event payload */
    const eventPayload = {
      topic,
      message: normalized,
      event_id: generateId(),
      timestamp: new Date().toISOString(),
      schema_version: "1.0.0"
    };

    /** Step 3 — Generate signature */
    const signature = signPayload(eventPayload, this.signingSecret);

    /** Step 4 — POST to Gateway */
    try {
      const res = await axios.post(
        `${this.baseUrl}/events/publish`,
        eventPayload,
        {
          headers: {
            "x-api-key": this.apiKey,
            "x-aibbar-signature": signature,
            "Content-Type": "application/json",
          },
        }
      );

      return res.data;

    } catch (err) {
      throw new Error(`Publish failed: ${(err as Error).message}`);
    }
  }

  /* ----------------------------------------------------------
   * Read events
   * ---------------------------------------------------------- */

  async readEvents(): Promise<any> {
    if (!this.apiKey) {
      throw new Error("Missing API key. Provide { apiKey } when creating the Client.");
    }

    try {
      const response = await axios.get(`${this.baseUrl}/events/read`, {
        headers: { "x-api-key": this.apiKey },
      });

      return response.data;

    } catch (err) {
      throw new Error(`Read events failed: ${(err as Error).message}`);
    }
  }
}

export default Client;
