#!/usr/bin/env node
import { execFile } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import { PrismaClient } from "@hockpay/database";
import {
  SmokeError,
  assert,
  buildCpf,
  createCookieJar,
  formatError,
  randomRunId,
  readEnvInt,
} from "./smoke/lib/smoke-utils.mjs";

const API_URL = process.env.HOCKPAY_API_URL ?? "http://localhost:3000/api/v1";
const TIMEOUT_MS = readEnvInt("HOCKPAY_SMOKE_TIMEOUT_MS", 60000, 1000);
const REDIS_CONTAINER =
  process.env.HOCKPAY_SMOKE_REDIS_CONTAINER ?? "hockpay-smoke-redis";
const runId = randomRunId();
const prisma = new PrismaClient();
let redisStopped = false;
let currentStage = "initializing";
let lastHttp;

function step(message) {
  currentStage = message;
  console.log(`[smoke:idempotency-redis-unavailable] ${message}`);
}

function apiPath(pathname) {
  return `${API_URL.replace(/\/$/, "")}${pathname}`;
}

function jsonBody(payload) {
  return JSON.stringify(payload);
}

function randomPassword() {
  return randomBytes(18).toString("base64url");
}

function uniqueCpf(offset) {
  return buildCpf(`${Date.now()}${runId}${offset}${randomInt(1000, 9999)}`);
}

function uniqueEmail(label) {
  return `smoke-idem-redis-${label}-${runId}@hockpay.local`;
}

function apiKeyHeaders(ctx, extra = {}) {
  return {
    Authorization: `Bearer ${ctx.apiKeyPlainKey}`,
    ...extra,
  };
}

async function requestHttp(pathname, options = {}) {
  const {
    body,
    cookieJar,
    jwtCookie = false,
    headers: optionHeaders,
    timeoutMs = TIMEOUT_MS,
    ...fetchOptions
  } = options;
  const method = fetchOptions.method ?? "GET";
  const headers = {
    Accept: "application/json",
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(jwtCookie && cookieJar ? cookieJar.header() : {}),
    ...optionHeaders,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  lastHttp = {
    stage: currentStage,
    method,
    path: pathname,
    requestBody: body ? parseMaybeJson(body) : undefined,
  };

  let response;
  try {
    response = await fetch(apiPath(pathname), {
      ...fetchOptions,
      body,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    throw new SmokeError(
      `Could not reach ${method} ${apiPath(pathname)} during "${currentStage}". ${formatError(error)}`,
      { stage: currentStage, lastHttp },
    );
  } finally {
    clearTimeout(timeout);
  }

  cookieJar?.capture(response.headers);
  const text = await response.text();
  const responseBody = text
    ? parseJson(text, `${method} ${pathname}`)
    : undefined;

  lastHttp = {
    ...lastHttp,
    status: response.status,
    responseBody,
  };

  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    body: responseBody,
    text,
  };
}

async function requestJson(pathname, options = {}) {
  const response = await requestHttp(pathname, options);
  if (!response.ok) {
    throw new SmokeError(
      `${options.method ?? "GET"} ${pathname} failed with ${response.status}: ${response.text || "empty response"}`,
      { stage: currentStage, lastHttp },
    );
  }
  return response.body;
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parseJson(text, context) {
  try {
    return JSON.parse(text);
  } catch {
    throw new SmokeError(
      `${context} returned non-JSON content: ${text.slice(0, 200)}`,
      {
        stage: currentStage,
        lastHttp,
      },
    );
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualJson = stableStringify(actual);
  const expectedJson = stableStringify(expected);
  assert(actualJson === expectedJson, message, { actual, expected });
}

function stableStringify(value) {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) {
          result[key] = sortObjectKeys(value[key]);
        }
        return result;
      }, {});
  }

  return value;
}

async function createContext() {
  const cookieJar = createCookieJar();
  const password = randomPassword();
  const merchantEmail = uniqueEmail("merchant");
  const merchantDocument = uniqueCpf(101);

  const merchant = await requestJson("/merchants", {
    method: "POST",
    cookieJar,
    body: jsonBody({
      name: `Idempotency Redis Merchant ${runId}`,
      email: merchantEmail,
      password,
      document: merchantDocument,
    }),
  });
  assert(merchant?.id, "Merchant creation did not return id.");

  const login = await requestJson("/auth/login", {
    method: "POST",
    cookieJar,
    body: jsonBody({
      email: merchantEmail,
      password,
    }),
  });
  assert(login?.accessToken, "Login did not return access token.");
  cookieJar.setFromAuthBody(login);

  const storeResult = await requestJson("/stores", {
    method: "POST",
    cookieJar,
    jwtCookie: true,
    body: jsonBody({
      name: `Idempotency Redis Store ${runId}`,
      slug: `idem-redis-${runId}`.replace(/[^a-z0-9-]/g, "-").slice(0, 50),
    }),
  });
  const storeId = storeResult?.store?.id;
  assert(storeId, "Store creation did not return id.");
  cookieJar.setFromAuthBody(storeResult);

  const apiKey = await requestJson("/api-keys", {
    method: "POST",
    cookieJar,
    jwtCookie: true,
    body: jsonBody({
      name: `Idempotency Redis TEST ${runId}`,
      environment: "TEST",
    }),
  });
  assert(apiKey?.plainKey, "API key creation did not return plainKey.");

  return {
    storeId,
    apiKeyPlainKey: apiKey.plainKey,
  };
}

function paymentInput() {
  return {
    idempotencyKey: `idempotency-redis-down-${runId}`,
    payload: {
      amount: 45678,
      externalId: `idempotency-redis-down-${runId}`,
      description: `Idempotency Redis unavailable ${runId}`,
      customer: {
        name: "Idempotency Redis Customer",
        email: uniqueEmail("customer"),
        document: uniqueCpf(202),
      },
      metadata: {
        smokeRunId: runId,
        scenario: "idempotency-redis-unavailable",
      },
    },
  };
}

async function createPayment(ctx, input) {
  return requestHttp("/payments", {
    method: "POST",
    headers: apiKeyHeaders(ctx, { "Idempotency-Key": input.idempotencyKey }),
    body: jsonBody(input.payload),
  });
}

async function assertPaymentPersistence(ctx, input, expectedBody) {
  const paymentId = expectedBody?.payment?.id;
  assert(paymentId, "Payment response did not include payment id.");

  const payments = await prisma.payment.findMany({
    where: {
      storeId: ctx.storeId,
      externalId: input.payload.externalId,
    },
  });
  assert(
    payments.length === 1,
    `Expected one payment row, got ${payments.length}.`,
  );
  assert(
    payments[0].id === paymentId,
    "Payment row id did not match response.",
  );

  const pixChargeCount = await prisma.pixCharge.count({
    where: {
      storeId: ctx.storeId,
      amount: input.payload.amount,
    },
  });
  assert(
    pixChargeCount === 1,
    `Expected one PixCharge row, got ${pixChargeCount}.`,
  );

  const outboxCount = await prisma.outboxEvent.count({
    where: {
      aggregateType: "Payment",
      aggregateId: paymentId,
      eventType: "payment.created",
    },
  });
  assert(
    outboxCount === 1,
    `Expected one payment.created outbox event, got ${outboxCount}.`,
  );

  // A reserva e unica por key + store + environment desde a isolacao TEST/LIVE.
  const record = await prisma.idempotencyKey.findUnique({
    where: {
      key_storeId_environment: {
        key: input.idempotencyKey,
        storeId: ctx.storeId,
        environment: "TEST",
      },
    },
  });
  assert(record, "Idempotency key was not stored in PostgreSQL.");
  assert(record.status === "COMPLETED", "Idempotency key was not completed.");
  assert(
    record.responseStatus === 201,
    "Idempotency responseStatus was not 201.",
  );
  assertDeepEqual(
    record.responseBody,
    expectedBody,
    "PostgreSQL idempotency responseBody did not match the response DTO.",
  );
}

function execFileText(command, args) {
  return new Promise((resolveExec, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolveExec(String(stdout).trim());
    });
  });
}

async function stopRedis() {
  step(`Stopping Redis container ${REDIS_CONTAINER}`);
  await execFileText("docker", ["stop", REDIS_CONTAINER]);
  redisStopped = true;
}

async function startRedis() {
  if (!redisStopped) {
    return;
  }

  step(`Restarting Redis container ${REDIS_CONTAINER}`);
  await execFileText("docker", ["start", REDIS_CONTAINER]);
  await waitForRedisPing();
  redisStopped = false;
}

async function waitForRedisPing() {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastError = "not requested";

  while (Date.now() < deadline) {
    try {
      const output = await execFileText("docker", [
        "exec",
        REDIS_CONTAINER,
        "redis-cli",
        "ping",
      ]);
      if (output === "PONG") {
        return;
      }
      lastError = output;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1000);
  }

  throw new Error(
    `Redis did not restart within ${TIMEOUT_MS}ms. Last error: ${lastError}`,
  );
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function main() {
  await prisma.$connect();

  try {
    step("Checking API readiness");
    const health = await requestJson("/health/ready");
    assert(
      health?.status === "ok",
      "Health ready endpoint did not return status=ok.",
    );

    step("Creating payment while Redis is available");
    const ctx = await createContext();
    const input = paymentInput();
    const created = await createPayment(ctx, input);
    assert(
      created.status === 201,
      `Initial payment expected 201, got ${created.status}.`,
    );
    assert(
      created.headers.get("x-idempotency-replayed") === "false",
      "Initial payment should not be marked as replayed.",
    );
    await assertPaymentPersistence(ctx, input, created.body);

    await stopRedis();

    step("Replaying payment while Redis is unavailable");
    const replay = await createPayment(ctx, input);
    assert(
      replay.status === 201,
      `Replay with Redis unavailable expected 201, got ${replay.status}. This may indicate a structural Redis dependency outside the idempotency cache.`,
      { lastHttp },
    );
    assert(
      replay.headers.get("x-idempotency-replayed") === "true",
      "Replay with Redis unavailable was not marked as replayed.",
    );
    assertDeepEqual(
      replay.body,
      created.body,
      "Replay with Redis unavailable did not return the persisted response DTO.",
    );
    await assertPaymentPersistence(ctx, input, created.body);

    step("Completed Redis unavailable idempotency smoke");
  } finally {
    await startRedis();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    `[smoke:idempotency-redis-unavailable] FAILED: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  if (error instanceof SmokeError && error.details) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exitCode = 1;
});
