import { createHmac, timingSafeEqual } from "crypto";

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  timestamp: number,
  signature: string,
): boolean {
  const signatureBase = `${secret}${timestamp}${rawBody}`;
  const hmac = createHmac("sha256", secret);
  hmac.update(signatureBase);
  const expected = `sha256=${hmac.digest("hex")}`;

  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
