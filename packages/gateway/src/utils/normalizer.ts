// packages/gateway/src/utils/normalizer.ts
import crypto from "crypto";

// Keys that must always be scrubbed for PII safety
const PII_KEYS = [
  "email",
  "phone",
  "mobile",
  "token",
  "password",
  "api_key",
  "secret",
  "ssn", 
  "address",
  "auth",
  "credentials"
];

function isObject(value: any) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function redactIfPII(key: string, value: any) {
  if (PII_KEYS.includes(key.toLowerCase())) {
    return "***redacted***";
  }
  return value;
}

/**
 * Normalize AIBBAR event:
 *  - normalize timestamps
 *  - inject `received_at`
 *  - add metadata flags
 *  - deep scrub PII
 */
export function normalizeAibbarEvent(event: any): any {
  const clone = structuredClone(event);

  //
  // 1. Normalize timestamps
  //
  clone.timestamp = new Date(clone.timestamp || Date.now()).toISOString();
  clone.received_at = new Date().toISOString();

  //
  // 2. Ensure metadata exists and mark normalized
  //
  clone.metadata = clone.metadata ?? {};
  clone.metadata.normalized = true;
  clone.metadata.normalized_version = "1.0";

  //
  // 3. Deep-scan and redact PII
  //
  function deepNormalize(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => deepNormalize(item));
    }

    if (!isObject(obj)) return obj;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const safeValue = redactIfPII(key, value);

      if (isObject(safeValue) || Array.isArray(safeValue)) {
        result[key] = deepNormalize(safeValue);
      } else {
        result[key] = safeValue;
      }
    }
    return result;
  }

  return deepNormalize(clone);
}
