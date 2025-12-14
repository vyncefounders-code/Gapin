// packages/sdk-js/src/normalizer.ts

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
 * Normalize event on the SDK side BEFORE signing and sending:
 *  - normalize timestamps
 *  - add metadata
 *  - deep-scrub PII
 */
export function normalizeSdkEvent(event: any): any {
  const clone = structuredClone(event);

  //
  // 1. Normalize timestamps
  //
  clone.timestamp = new Date(clone.timestamp || Date.now()).toISOString();
  clone.sent_at = new Date().toISOString();

  //
  // 2. Metadata flags
  //
  clone.metadata = clone.metadata ?? {};
  clone.metadata.sdk_normalized = true;
  clone.metadata.sdk_version = "1.0";

  //
  // 3. Deep-scrub PII
  //
  function deepNormalize(obj: any): any {
    if (Array.isArray(obj)) return obj.map((i) => deepNormalize(i));
    if (!isObject(obj)) return obj;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const safe = redactIfPII(key, value);

      if (isObject(safe) || Array.isArray(safe)) {
        result[key] = deepNormalize(safe);
      } else {
        result[key] = safe;
      }
    }
    return result;
  }

  return deepNormalize(clone);
}
