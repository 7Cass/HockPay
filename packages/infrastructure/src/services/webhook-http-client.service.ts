import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent } from 'undici';
import {
  IWebhookSenderPort,
  WebhookResponse,
  WebhookResolvedAddress,
  WebhookUrlPolicyOptions,
  WebhookUrlPolicyResult,
  validateWebhookResolvedAddress,
  validateWebhookUrl,
} from '@hockpay/core';

type PreparedWebhookTarget =
  | { valid: false; result: WebhookUrlPolicyResult }
  | {
      valid: true;
      requestUrl: string;
      serverName: string;
      hostHeader: string;
    };

type WebhookHttpLogger = {
  debug(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

export interface WebhookHttpClientOptions {
  timeoutMs?: number;
  logger?: WebhookHttpLogger;
  webhookUrlPolicyOptions?: WebhookUrlPolicyOptions;
  dnsLookup?: WebhookDnsLookup;
  maxRedirects?: number;
}

type WebhookDnsLookup = (hostname: string) => Promise<WebhookResolvedAddress[]>;

const DEFAULT_MAX_REDIRECTS = 5;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

/**
 * Implementation of IWebhookSenderPort using native fetch.
 */
export class WebhookHttpClientService implements IWebhookSenderPort {
  private readonly timeoutMs: number;
  private readonly logger?: WebhookHttpLogger;
  private readonly webhookUrlPolicyOptions: WebhookUrlPolicyOptions;
  private readonly dnsLookup: WebhookDnsLookup;
  private readonly maxRedirects: number;

  constructor(options: WebhookHttpClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.logger = options.logger;
    this.webhookUrlPolicyOptions = options.webhookUrlPolicyOptions ?? {};
    this.dnsLookup =
      options.dnsLookup ?? ((hostname) => lookup(hostname, { all: true, verbatim: true }));
    this.maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  }

  async send(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<WebhookResponse> {
    try {
      return await this.sendWithManualRedirects(url, payload, headers);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error(`Failed to send webhook to ${url}: ${errorMessage}`);

      return {
        statusCode: 0,
        body: errorMessage,
        success: false,
      };
    }
  }

  private async sendWithManualRedirects(
    initialUrl: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<WebhookResponse> {
    let currentUrl = initialUrl;

    for (let redirects = 0; redirects <= this.maxRedirects; redirects += 1) {
      const prepared = await this.prepareTarget(currentUrl);
      if (!prepared.valid) {
        return this.blockedResponse(currentUrl, prepared.result);
      }

      const response = await this.fetchOnce(prepared, payload, headers);

      if (!REDIRECT_STATUS_CODES.has(response.status)) {
        return this.responseFromFetchResult(currentUrl, response);
      }

      const location = response.headers.get('location');
      if (!location) {
        const body = await response.text();
        this.logger?.warn(
          `Webhook redirect ${response.status} for ${currentUrl} did not include Location`,
        );

        return {
          statusCode: response.status,
          body,
          success: false,
        };
      }

      if (redirects === this.maxRedirects) {
        const message = 'Webhook redirect limit exceeded.';
        this.logger?.warn(`Blocked webhook target ${currentUrl}: ${message}`);

        return {
          statusCode: 0,
          body: message,
          success: false,
        };
      }

      currentUrl = new URL(location, currentUrl).toString();
    }

    return {
      statusCode: 0,
      body: 'Webhook redirect limit exceeded.',
      success: false,
    };
  }

  private async prepareTarget(url: string): Promise<PreparedWebhookTarget> {
    const policyResult = validateWebhookUrl(url, this.webhookUrlPolicyOptions);
    if (!policyResult.valid) {
      return { valid: false, result: policyResult };
    }

    const parsed = new URL(url);
    if (isExplicitLocalHttpTarget(parsed, this.webhookUrlPolicyOptions)) {
      return this.directTarget(parsed);
    }

    if (isIP(parsed.hostname)) {
      const ipPolicy = validateWebhookResolvedAddress({
        address: parsed.hostname,
      });
      if (!ipPolicy.valid) {
        return { valid: false, result: ipPolicy };
      }

      return this.directTarget(parsed);
    }

    const firstLookup = await this.resolvePublicAddresses(parsed.hostname);
    if (!firstLookup.valid) {
      return { valid: false, result: firstLookup.result };
    }

    const secondLookup = await this.resolvePublicAddresses(parsed.hostname);
    if (!secondLookup.valid) {
      return { valid: false, result: secondLookup.result };
    }

    if (!sameResolvedAddresses(firstLookup.addresses, secondLookup.addresses)) {
      return {
        valid: false,
        result: {
          valid: false,
          message: 'Webhook URL resolved to a different address before connect.',
        },
      };
    }

    const pinnedAddress = firstLookup.addresses[0];
    if (!pinnedAddress) {
      return {
        valid: false,
        result: {
          valid: false,
          message: 'Webhook URL hostname did not resolve.',
        },
      };
    }

    return {
      valid: true,
      requestUrl: rewriteUrlHostToIp(parsed, pinnedAddress.address),
      serverName: parsed.hostname,
      hostHeader: parsed.host,
    };
  }

  private directTarget(parsed: URL): PreparedWebhookTarget {
    return {
      valid: true,
      requestUrl: parsed.toString(),
      serverName: parsed.hostname,
      hostHeader: parsed.host,
    };
  }

  private async resolvePublicAddresses(
    hostname: string,
  ): Promise<
    | { valid: true; addresses: WebhookResolvedAddress[] }
    | { valid: false; result: WebhookUrlPolicyResult }
  > {
    const resolvedAddresses = await this.dnsLookup(hostname);
    if (resolvedAddresses.length === 0) {
      return {
        valid: false,
        result: {
          valid: false,
          message: 'Webhook URL hostname did not resolve.',
        },
      };
    }

    for (const resolvedAddress of resolvedAddresses) {
      const resolvedPolicyResult = validateWebhookResolvedAddress(resolvedAddress);
      if (!resolvedPolicyResult.valid) {
        return { valid: false, result: resolvedPolicyResult };
      }
    }

    return { valid: true, addresses: resolvedAddresses };
  }

  private async fetchOnce(
    target: Extract<PreparedWebhookTarget, { valid: true }>,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const requestUrl = new URL(target.requestUrl);
    const dispatcher =
      requestUrl.protocol === 'https:'
        ? new Agent({ connect: { servername: target.serverName } })
        : undefined;

    try {
      return await fetch(target.requestUrl, {
        method: 'POST',
        headers: {
          ...headers,
          Host: target.hostHeader,
        },
        body: JSON.stringify(payload),
        redirect: 'manual',
        signal: controller.signal,
        ...(dispatcher ? { dispatcher } : {}),
      } as RequestInit);
    } finally {
      clearTimeout(timeoutId);
      await dispatcher?.close();
    }
  }

  private async responseFromFetchResult(url: string, response: Response): Promise<WebhookResponse> {
    const body = await response.text();

    if (response.ok) {
      this.logger?.debug(`Webhook sent successfully to ${url}`);
      return {
        statusCode: response.status,
        body,
        success: true,
      };
    }

    this.logger?.warn(`Webhook returned ${response.status} for ${url}: ${body}`);
    return {
      statusCode: response.status,
      body,
      success: false,
    };
  }

  private blockedResponse(url: string, policyResult: WebhookUrlPolicyResult): WebhookResponse {
    const message = policyResult.message ?? 'Webhook URL is not allowed';
    this.logger?.warn(`Blocked webhook target ${url}: ${message}`);

    return {
      statusCode: 0,
      body: message,
      success: false,
    };
  }
}

function sameResolvedAddresses(
  first: WebhookResolvedAddress[],
  second: WebhookResolvedAddress[],
): boolean {
  const firstSet = new Set(first.map((entry) => `${entry.family ?? ''}:${entry.address}`));
  const secondSet = new Set(second.map((entry) => `${entry.family ?? ''}:${entry.address}`));
  if (firstSet.size !== secondSet.size) {
    return false;
  }
  for (const value of firstSet) {
    if (!secondSet.has(value)) {
      return false;
    }
  }
  return true;
}

function rewriteUrlHostToIp(parsed: URL, address: string): string {
  const rewritten = new URL(parsed.toString());
  rewritten.hostname = isIP(address) === 6 ? `[${address}]` : address;
  return rewritten.toString();
}

function isExplicitLocalHttpTarget(parsed: URL, options: WebhookUrlPolicyOptions): boolean {
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');

  return (
    parsed.protocol === 'http:' &&
    options.allowLocalHttp === true &&
    (hostname === 'localhost' || hostname === '127.0.0.1')
  );
}
