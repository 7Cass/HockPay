#!/usr/bin/env node
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import {
  OutboxStatus,
  PrismaClient,
  WithdrawalStatus,
} from '@hockpay/database';
import {
  OutboxRepository,
  WithdrawalRepository,
} from '@hockpay/infrastructure';
import {
  SmokeError,
  assert,
  buildCpf,
  createCookieJar,
  formatError,
  pollUntil,
  randomRunId,
  readEnvInt,
} from './smoke/lib/smoke-utils.mjs';

const API_URL = process.env.HOCKPAY_API_URL ?? 'http://localhost:3000/api/v1';
const TIMEOUT_MS = readEnvInt('HOCKPAY_SMOKE_TIMEOUT_MS', 60000, 1000);
const POLL_INTERVAL_MS = 500;
const WITHDRAWAL_FEE = 199;
const FUNDING_PAYMENT_AMOUNT = 40000;

const runId = randomRunId();
const prisma = new PrismaClient();
let currentStage = 'initializing';
let lastHttp;

function step(message) {
  currentStage = message;
  console.log(`[smoke:db-concurrency] ${message}`);
}

function apiPath(pathname) {
  return `${API_URL.replace(/\/$/, '')}${pathname}`;
}

function randomPassword() {
  return randomBytes(18).toString('base64url');
}

function uniqueCpf(offset) {
  return buildCpf(`${Date.now()}${runId}${offset}${randomInt(1000, 9999)}`);
}

function uniqueEmail(label) {
  return `smoke-db-concurrency-${label}-${runId}@hockpay.local`;
}

function jsonBody(payload) {
  return JSON.stringify(payload);
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
  const method = fetchOptions.method ?? 'GET';
  const headers = {
    Accept: 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
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
      `${options.method ?? 'GET'} ${pathname} failed with ${response.status}: ${response.text || 'empty response'}`,
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
    throw new SmokeError(`${context} returned non-JSON content: ${text.slice(0, 200)}`, {
      stage: currentStage,
      lastHttp,
    });
  }
}

async function createContext() {
  step('Creating merchant, store, API key and verified Pix account');
  const cookieJar = createCookieJar();
  const password = randomPassword();
  const merchantDocument = uniqueCpf(1);
  const email = uniqueEmail('merchant');

  const merchant = await requestJson('/merchants', {
    method: 'POST',
    cookieJar,
    body: jsonBody({
      name: `DB Concurrency Merchant ${runId}`,
      email,
      password,
      document: merchantDocument,
    }),
  });
  assert(merchant?.id, 'Merchant creation did not return an id.');

  const login = await requestJson('/auth/login', {
    method: 'POST',
    cookieJar,
    body: jsonBody({ email, password }),
  });
  assert(login?.accessToken, 'Login did not return an access token.');
  cookieJar.setFromAuthBody(login);

  const storeResult = await requestJson('/stores', {
    method: 'POST',
    cookieJar,
    jwtCookie: true,
    body: jsonBody({
      name: `DB Concurrency Store ${runId}`,
      slug: `db-concurrency-${runId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 50),
    }),
  });
  const storeId = storeResult?.store?.id;
  assert(storeId, 'Store creation did not return a store id.');
  cookieJar.setFromAuthBody(storeResult);

  const account = await requestJson('/accounts/me', {
    cookieJar,
    jwtCookie: true,
  });
  const accountId = account?.account?.id;
  assert(account?.account?.storeId === storeId, 'Account lookup did not match the created store.');

  const apiKey = await requestJson('/api-keys', {
    method: 'POST',
    cookieJar,
    jwtCookie: true,
    body: jsonBody({
      name: `DB Concurrency TEST ${runId}`,
      environment: 'TEST',
    }),
  });
  assert(apiKey?.plainKey, 'API key creation did not return plainKey.');

  const bankAccount = await requestJson('/bank-accounts', {
    method: 'POST',
    cookieJar,
    jwtCookie: true,
    body: jsonBody({
      pixKey: merchantDocument,
      pixKeyType: 'CPF',
      holderName: `DB Concurrency Merchant ${runId}`,
      holderDocument: merchantDocument,
      isDefault: true,
    }),
  });
  assert(bankAccount?.id, 'Bank account creation did not return an id.');
  assert(bankAccount?.isVerified === true, 'Bank account should be auto-verified.');

  return {
    accountId,
    apiKeyPlainKey: apiKey.plainKey,
    bankAccountId: bankAccount.id,
    cookieJar,
    merchantDocument,
    storeId,
  };
}

async function fundAvailableBalance(ctx) {
  step('Funding and releasing account balance');
  const payment = await requestJson('/payments', {
    method: 'POST',
    headers: apiKeyHeaders(ctx, {
      'Idempotency-Key': `db-concurrency-${runId}-funding`,
    }),
    body: jsonBody({
      externalId: `db-concurrency-${runId}-funding`,
      amount: FUNDING_PAYMENT_AMOUNT,
      description: 'DB concurrency smoke funding payment',
      paymentMethod: 'PIX',
      customer: {
        name: 'DB Concurrency Customer',
        email: uniqueEmail('customer'),
        document: uniqueCpf(2),
      },
      metadata: {
        smokeRunId: runId,
        source: 'db-concurrency',
      },
    }),
  });
  const paymentId = payment?.payment?.id;
  assert(paymentId, 'Funding payment creation did not return a payment id.');

  await requestJson(`/dev/simulate/${paymentId}/confirm`, {
    method: 'POST',
    headers: apiKeyHeaders(ctx),
  });
  await requestJson(`/dev/simulate/${paymentId}/release`, {
    method: 'POST',
    headers: apiKeyHeaders(ctx),
  });

  const releasedPayment = await requestJson(`/payments/${paymentId}`, {
    headers: apiKeyHeaders(ctx),
  });
  assert(releasedPayment?.payment?.status === 'RELEASED', 'Funding payment should be RELEASED.');

  const account = await pollUntil(
    'released account balance',
    () => requestJson('/accounts/me', { cookieJar: ctx.cookieJar, jwtCookie: true }),
    (result) => result?.account?.available === releasedPayment.payment.netAmount,
    { timeoutMs: TIMEOUT_MS, intervalMs: POLL_INTERVAL_MS },
  );

  return {
    account: account.account,
    payment: releasedPayment.payment,
  };
}

async function runOutboxClaimConcurrency() {
  step('Claiming outbox events concurrently through OutboxRepository');
  const requestId = `smoke-db-concurrency-outbox-${runId}`;
  const now = new Date();
  const watchdogUntil = new Date(now.getTime() + 60000);
  const fixtureCreatedAt = new Date('2000-01-01T00:00:00.000Z');
  const seededEvents = Array.from({ length: 4 }, (_, index) => ({
    id: randomUUID(),
    aggregateType: 'SmokeDbConcurrency',
    aggregateId: `${runId}-${index}`,
    eventType: 'payment.created',
    requestId,
    payload: { runId, index },
    status: OutboxStatus.PENDING,
    createdAt: new Date(fixtureCreatedAt.getTime() + index),
  }));
  const seededIds = seededEvents.map((event) => event.id);

  await prisma.outboxEvent.createMany({
    data: seededEvents,
  });

  const claimerA = new PrismaClient();
  const claimerB = new PrismaClient();
  const outboxRepositoryA = new OutboxRepository(claimerA);
  const outboxRepositoryB = new OutboxRepository(claimerB);
  try {
    const [firstClaim, secondClaim] = await Promise.all([
      outboxRepositoryA.claimDispatchableEvents({
        limit: 2,
        now,
        watchdogUntil,
      }),
      outboxRepositoryB.claimDispatchableEvents({
        limit: 2,
        now,
        watchdogUntil,
      }),
    ]);

    const claimedIds = [...firstClaim, ...secondClaim].map((event) => event.id);
    const uniqueClaimedIds = new Set(claimedIds);
    assert(
      claimedIds.length === 4 && uniqueClaimedIds.size === 4,
      'Concurrent outbox claimers should claim each event exactly once.',
      { firstClaim, secondClaim },
    );

    const overlap = firstClaim.filter((event) =>
      secondClaim.some((otherEvent) => otherEvent.id === event.id),
    );
    assert(overlap.length === 0, 'Concurrent outbox claimers returned overlapping ids.', {
      firstClaim,
      secondClaim,
    });
    assertSameIds(
      claimedIds,
      seededIds,
      'Concurrent outbox claimers should claim exactly the seeded events.',
      {
        claimedIds,
        seededIds,
        firstClaim: firstClaim.map((event) => event.id),
        secondClaim: secondClaim.map((event) => event.id),
      },
    );
  } finally {
    await Promise.allSettled([claimerA.$disconnect(), claimerB.$disconnect()]);
  }

  const rows = await prisma.outboxEvent.findMany({
    where: { id: { in: seededIds } },
    select: { id: true, status: true, nextRetryAt: true },
  });
  assertSameIds(
    rows.map((event) => event.id),
    seededIds,
    'Seeded outbox rows should be present after repository claims.',
    { rows, seededIds },
  );
  assert(rows.every((event) => event.status === OutboxStatus.DISPATCHED), 'Claimed outbox events should be DISPATCHED.', {
    rows,
  });
  assert(rows.every((event) => event.nextRetryAt !== null), 'Claimed outbox events should have a watchdog timestamp.', {
    rows,
  });
}

async function runWithdrawalClaimConcurrency(ctx) {
  step('Claiming one withdrawal concurrently through WithdrawalRepository');
  const now = new Date();
  const amount = 5000;
  const withdrawal = await prisma.withdrawal.create({
    data: {
      accountId: ctx.accountId,
      bankAccountId: ctx.bankAccountId,
      amount,
      fee: WITHDRAWAL_FEE,
      netAmount: amount - WITHDRAWAL_FEE,
      status: WithdrawalStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    },
  });

  const staleProcessingBefore = new Date(now.getTime() - 5 * 60 * 1000);
  const claimerA = new PrismaClient();
  const claimerB = new PrismaClient();
  const withdrawalRepositoryA = new WithdrawalRepository(claimerA);
  const withdrawalRepositoryB = new WithdrawalRepository(claimerB);
  let claims;
  try {
    claims = await Promise.all([
      withdrawalRepositoryA.claimProcessableWithdrawals({
        limit: 1,
        now,
        staleProcessingBefore,
      }),
      withdrawalRepositoryB.claimProcessableWithdrawals({
        limit: 1,
        now,
        staleProcessingBefore,
      }),
    ]);
  } finally {
    await Promise.allSettled([claimerA.$disconnect(), claimerB.$disconnect()]);
  }

  const claimed = claims.flat();
  assert(claimed.length === 1, 'Concurrent withdrawal claimers should claim the row once.', {
    claims,
  });
  assert(claimed[0]?.id === withdrawal.id, 'Withdrawal claimer returned an unexpected id.', {
    claimed,
    withdrawalId: withdrawal.id,
  });

  const row = await prisma.withdrawal.findUnique({
    where: { id: withdrawal.id },
    select: { id: true, status: true, processingAttempts: true },
  });
  assert(row?.status === WithdrawalStatus.PROCESSING, 'Claimed withdrawal should be PROCESSING.', {
    row,
  });
  assert(row?.processingAttempts === 1, 'Claimed withdrawal should increment attempts exactly once.', {
    row,
  });
}

async function runConcurrentWithdrawalBalance(ctx, available) {
  step('Creating competing withdrawals against the same balance');
  const amount = Math.max(1000, Math.floor(available * 0.7));
  assert(
    amount <= available && amount * 2 > available,
    'Withdrawal amount should allow exactly one competing request to reserve balance.',
    { available, amount },
  );

  const responses = await Promise.all([
    createWithdrawalHttp(ctx, amount, `db-concurrency-${runId}-withdrawal-a`),
    createWithdrawalHttp(ctx, amount, `db-concurrency-${runId}-withdrawal-b`),
  ]);
  const successful = responses.filter((response) => response.ok);
  const failed = responses.filter((response) => !response.ok);

  assert(successful.length === 1, 'Exactly one competing withdrawal should succeed.', {
    responses: responses.map(summarizeHttpResponse),
  });
  assert(failed.length === 1, 'Exactly one competing withdrawal should fail.', {
    responses: responses.map(summarizeHttpResponse),
  });
  assert(
    failed[0].status >= 400 && failed[0].status < 500,
    'The losing withdrawal should fail with a client error, not create another reservation.',
    { failed: summarizeHttpResponse(failed[0]) },
  );
  assert(
    failed[0].body?.error?.code === undefined ||
      failed[0].body.error.code === 'INSUFFICIENT_WITHDRAWAL_BALANCE',
    'The losing withdrawal should fail because the locked balance was no longer available.',
    { failed: summarizeHttpResponse(failed[0]) },
  );

  const withdrawal = successful[0].body?.withdrawal;
  assert(withdrawal?.id, 'Successful competing withdrawal did not return an id.', {
    successful: summarizeHttpResponse(successful[0]),
  });
  assert(withdrawal.amount === amount, 'Successful withdrawal amount mismatch.', {
    withdrawal,
    amount,
  });

  const createdCount = await prisma.withdrawal.count({
    where: {
      accountId: ctx.accountId,
      bankAccountId: ctx.bankAccountId,
      amount,
    },
  });
  assert(createdCount === 1, 'Competing withdrawals should create only one domain row.', {
    createdCount,
    amount,
  });

  const account = await requestJson('/accounts/me', {
    cookieJar: ctx.cookieJar,
    jwtCookie: true,
  });
  assert(account?.account?.available === available - amount, 'Available balance should be decremented once.', {
    account: account?.account,
    available,
    amount,
  });
  assert(account?.account?.blocked === amount, 'Blocked balance should be incremented once.', {
    account: account?.account,
    amount,
  });
}

function createWithdrawalHttp(ctx, amount, idempotencyKey) {
  return requestHttp('/withdrawals', {
    method: 'POST',
    cookieJar: ctx.cookieJar,
    jwtCookie: true,
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: jsonBody({
      bankAccountId: ctx.bankAccountId,
      amount,
    }),
  });
}

function summarizeHttpResponse(response) {
  return {
    status: response.status,
    ok: response.ok,
    headers: {
      idempotencyReplayed: response.headers.get('x-idempotency-replayed'),
      requestId: response.headers.get('x-request-id'),
    },
    body: response.body,
  };
}

function assertSameIds(actualIds, expectedIds, message, details = {}) {
  const actual = [...actualIds].sort();
  const expected = [...expectedIds].sort();
  assert(
    actual.length === expected.length &&
      actual.every((id, index) => id === expected[index]),
    message,
    { ...details, actual, expected },
  );
}

async function main() {
  step(`Using API ${API_URL}`);
  await runOutboxClaimConcurrency();
  const ctx = await createContext();
  await runWithdrawalClaimConcurrency(ctx);
  const funding = await fundAvailableBalance(ctx);
  await runConcurrentWithdrawalBalance(ctx, funding.payment.netAmount);
  step('DB concurrency smoke passed');
}

main()
  .catch((error) => {
    console.error(
      `[smoke:db-concurrency] FAILED during "${currentStage}": ${formatError(error)}`,
    );
    if (error instanceof SmokeError && error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    } else if (lastHttp) {
      console.error(JSON.stringify({ lastHttp }, null, 2));
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
