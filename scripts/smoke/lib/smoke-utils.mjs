import { randomInt } from 'node:crypto';
import { createServer } from 'node:http';

export class SmokeError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'SmokeError';
    this.details = details;
  }
}

export function randomRunId() {
  return `${Date.now()}-${randomInt(1000, 9999)}`;
}

export function readEnvInt(name, fallback, minimum = 1) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new SmokeError(`${name} must be an integer >= ${minimum}. Received: ${raw}`);
  }

  return parsed;
}

export function assert(condition, message, details) {
  if (!condition) {
    throw new SmokeError(message, details);
  }
}

export function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollUntil(label, read, isReady, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30000;
  const intervalMs = options.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastValue;

  while (Date.now() < deadline) {
    lastValue = await read();
    if (isReady(lastValue)) {
      return lastValue;
    }
    await sleep(intervalMs);
  }

  throw new SmokeError(
    `${label} was not observed within ${timeoutMs}ms. Last value: ${JSON.stringify(lastValue)}`,
  );
}

export function createCookieJar() {
  const cookies = new Map();

  return {
    setFromAuthBody(body) {
      if (body?.accessToken) cookies.set('hockpay_at', body.accessToken);
      if (body?.refreshToken) cookies.set('hockpay_rt', body.refreshToken);
    },
    header() {
      const cookie = [...cookies.entries()]
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
      return cookie ? { Cookie: cookie } : {};
    },
    capture(headers) {
      for (const setCookie of getSetCookieHeaders(headers)) {
        const [cookiePair] = setCookie.split(';');
        const separatorIndex = cookiePair.indexOf('=');
        if (separatorIndex <= 0) continue;

        const name = cookiePair.slice(0, separatorIndex).trim();
        const value = cookiePair.slice(separatorIndex + 1).trim();
        if (value) cookies.set(name, value);
        else cookies.delete(name);
      }
    },
  };
}

export function createApiClient(baseUrl, options = {}) {
  const cookieJar = options.cookieJar ?? createCookieJar();
  const timeoutMs = options.timeoutMs ?? 30000;

  function path(pathname) {
    return `${baseUrl.replace(/\/$/, '')}${pathname}`;
  }

  async function requestJson(pathname, requestOptions = {}) {
    const {
      jwtCookie = false,
      body,
      headers: optionHeaders,
      timeoutMs: requestTimeoutMs = timeoutMs,
      ...fetchOptions
    } = requestOptions;
    const method = fetchOptions.method ?? 'GET';
    const headers = {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(jwtCookie ? cookieJar.header() : {}),
      ...optionHeaders,
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response;
    try {
      response = await fetch(path(pathname), {
        ...fetchOptions,
        body,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      throw new SmokeError(
        `Could not reach ${method} ${path(pathname)}. Confirm the target service is running. ${formatError(error)}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    cookieJar.capture(response.headers);
    const text = await response.text();
    const responseBody = text ? parseJson(text, `${method} ${pathname}`) : undefined;

    if (!response.ok) {
      throw new SmokeError(
        `${method} ${pathname} failed with ${response.status}: ${text || 'empty response'}`,
      );
    }

    return responseBody;
  }

  return { requestJson, path, cookieJar };
}

export async function startWebhookReceiver({ port, path = '/webhook', label = 'webhook' }) {
  const deliveries = [];
  const receiver = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== path) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks).toString('utf8');
    deliveries.push({
      headers: request.headers,
      body: rawBody ? parseJson(rawBody, `${label} receiver`) : undefined,
      rawBody,
    });

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ received: true }));
  });

  await new Promise((resolve, reject) => {
    receiver.once('error', (error) => {
      reject(
        new SmokeError(
          `Could not start the local ${label} receiver on port ${port}. ${formatError(error)}`,
        ),
      );
    });
    receiver.listen(port, '127.0.0.1', resolve);
  });

  return {
    url: `http://127.0.0.1:${port}${path}`,
    deliveries,
    close: () =>
      new Promise((resolve, reject) => {
        if (!receiver.listening) {
          resolve();
          return;
        }
        receiver.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

export function buildCpf(seed) {
  const base = String(seed).replace(/\D/g, '').padStart(9, '0').slice(-9);
  const digits = base.split('').map(Number);
  const digit1 = calculateCpfDigit(digits, 10);
  const digit2 = calculateCpfDigit([...digits, digit1], 11);
  return `${base}${digit1}${digit2}`;
}

function calculateCpfDigit(digits, startWeight) {
  const sum = digits.reduce(
    (total, digit, index) => total + digit * (startWeight - index),
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function parseJson(text, context) {
  try {
    return JSON.parse(text);
  } catch {
    throw new SmokeError(`${context} returned non-JSON content: ${text.slice(0, 200)}`);
  }
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  if (typeof headers.raw === 'function') return headers.raw()['set-cookie'] ?? [];

  const combined = headers.get('set-cookie');
  return combined ? splitSetCookieHeader(combined) : [];
}

function splitSetCookieHeader(header) {
  const cookies = [];
  let start = 0;
  let inExpires = false;

  for (let index = 0; index < header.length; index += 1) {
    const char = header[index];
    const lowerTail = header.slice(index, index + 8).toLowerCase();

    if (lowerTail === 'expires=') {
      inExpires = true;
      index += 7;
      continue;
    }

    if (inExpires && char === ';') {
      inExpires = false;
      continue;
    }

    if (!inExpires && char === ',') {
      const next = header.slice(index + 1);
      if (/^\s*[^=;,\s]+=/.test(next)) {
        cookies.push(header.slice(start, index).trim());
        start = index + 1;
      }
    }
  }

  cookies.push(header.slice(start).trim());
  return cookies.filter(Boolean);
}
