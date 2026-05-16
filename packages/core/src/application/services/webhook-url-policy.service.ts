import { isIP } from "node:net";
import { InvalidWebhookUrlError } from "../../domain/errors/invalid-webhook-url.error";

export interface WebhookUrlPolicyOptions {
  allowLocalHttp?: boolean;
}

export interface WebhookUrlPolicyResult {
  valid: boolean;
  message?: string;
}

const PUBLIC_HTTPS_MESSAGE =
  "Webhook URL must be a public HTTPS endpoint. Local HTTP is allowed only for localhost/127.0.0.1 in development.";

export function getWebhookUrlPolicyOptionsForNodeEnv(
  nodeEnv: string | undefined,
): WebhookUrlPolicyOptions {
  const normalized = nodeEnv?.trim().toLowerCase();

  return {
    allowLocalHttp:
      !normalized ||
      normalized === "development" ||
      normalized === "dev" ||
      normalized === "local" ||
      normalized === "test",
  };
}

export function isWebhookUrlAllowed(
  url: string,
  options: WebhookUrlPolicyOptions = {},
): boolean {
  return validateWebhookUrl(url, options).valid;
}

export function assertWebhookUrlAllowed(
  url: string,
  options: WebhookUrlPolicyOptions = {},
): string {
  const result = validateWebhookUrl(url, options);

  if (!result.valid) {
    throw new InvalidWebhookUrlError(result.message ?? PUBLIC_HTTPS_MESSAGE);
  }

  return url;
}

export function validateWebhookUrl(
  url: string,
  options: WebhookUrlPolicyOptions = {},
): WebhookUrlPolicyResult {
  if (typeof url !== "string" || url.trim() !== url || url.length === 0) {
    return invalid("Webhook URL must be a valid absolute URL.");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return invalid("Webhook URL must be a valid absolute URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return invalid("Webhook URL must use HTTP or HTTPS.");
  }

  if (parsed.username || parsed.password) {
    return invalid("Webhook URL must not include embedded credentials.");
  }

  const hostname = normalizeHostname(parsed.hostname);

  if (parsed.protocol === "http:") {
    if (options.allowLocalHttp && isAllowedLocalHttpHost(hostname)) {
      return { valid: true };
    }

    return invalid(
      "HTTP webhook URLs are allowed only for localhost/127.0.0.1 in development.",
    );
  }

  if (isBlockedLocalOrPrivateHost(hostname)) {
    return invalid("Webhook URL host must be a public remote host.");
  }

  return { valid: true };
}

function invalid(message: string): WebhookUrlPolicyResult {
  return { valid: false, message };
}

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.$/, "");
}

function isAllowedLocalHttpHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isBlockedLocalOrPrivateHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }

  const ipVersion = isIP(hostname);

  if (ipVersion === 4) {
    const octets = parseIpv4Octets(hostname);
    return octets === null || isBlockedIpv4(octets);
  }

  if (ipVersion === 6) {
    return isBlockedIpv6(hostname);
  }

  return false;
}

function parseIpv4Octets(hostname: string): number[] | null {
  const parts = hostname.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => Number(part));
  if (
    octets.some(
      (octet, index) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255 ||
        parts[index] !== String(octet),
    )
  ) {
    return null;
  }

  return octets;
}

function isBlockedIpv4([a, b]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isBlockedIpv6(hostname: string): boolean {
  const words = expandIpv6Words(hostname);

  if (!words) {
    return true;
  }

  const isUnspecified = words.every((word) => word === 0);
  const isLoopback =
    words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  const isUniqueLocal = (words[0] & 0xfe00) === 0xfc00;
  const isLinkLocal = (words[0] & 0xffc0) === 0xfe80;
  const mappedIpv4 = getMappedIpv4Octets(words);

  return (
    isUnspecified ||
    isLoopback ||
    isUniqueLocal ||
    isLinkLocal ||
    (mappedIpv4 !== null && isBlockedIpv4(mappedIpv4))
  );
}

function getMappedIpv4Octets(words: number[]): number[] | null {
  const firstFiveZero = words.slice(0, 5).every((word) => word === 0);
  if (!firstFiveZero || (words[5] !== 0xffff && words[5] !== 0)) {
    return null;
  }

  return [words[6] >> 8, words[6] & 0xff, words[7] >> 8, words[7] & 0xff];
}

function expandIpv6Words(hostname: string): number[] | null {
  let input = hostname.toLowerCase();
  const zoneIndex = input.indexOf("%");
  if (zoneIndex >= 0) {
    input = input.slice(0, zoneIndex);
  }

  const embeddedIpv4Match = input.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embeddedIpv4Match) {
    const octets = parseIpv4Octets(embeddedIpv4Match[1]);
    if (!octets) {
      return null;
    }

    const firstWord = (octets[0] << 8) + octets[1];
    const secondWord = (octets[2] << 8) + octets[3];
    input = `${input.slice(
      0,
      input.length - embeddedIpv4Match[1].length,
    )}${firstWord.toString(16)}:${secondWord.toString(16)}`;
  }

  const doubleColonParts = input.split("::");
  if (doubleColonParts.length > 2) {
    return null;
  }

  const head = splitIpv6Part(doubleColonParts[0]);
  const tail =
    doubleColonParts.length === 2 ? splitIpv6Part(doubleColonParts[1]) : [];

  if (!head || !tail) {
    return null;
  }

  const fillLength =
    doubleColonParts.length === 2 ? 8 - head.length - tail.length : 0;
  if (fillLength < 0 || (doubleColonParts.length === 1 && head.length !== 8)) {
    return null;
  }

  return [...head, ...Array(fillLength).fill(0), ...tail];
}

function splitIpv6Part(part: string): number[] | null {
  if (!part) {
    return [];
  }

  const words = part.split(":");
  return words
    .map((word) => {
      if (!/^[0-9a-f]{1,4}$/.test(word)) {
        return Number.NaN;
      }

      return Number.parseInt(word, 16);
    })
    .every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffff)
    ? words.map((word) => Number.parseInt(word, 16))
    : null;
}
