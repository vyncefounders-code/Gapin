import crypto from "crypto";

export function signEvent(event: any, secret: string): string {
  const payload = JSON.stringify(event);
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyEventSignature(event: any, signature: string, secret: string): boolean {
  const calculated = signEvent(event, secret);
  return crypto.timingSafeEqual(
    Buffer.from(calculated),
    Buffer.from(signature)
  );
}
