#!/usr/bin/env node
import { createHash, randomBytes, randomInt } from 'node:crypto';
import Redis from 'ioredis';
import { PrismaClient } from '@hockpay/database';
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
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const TIMEOUT_MS = readEnvInt('HOCKPAY_SMOKE_TIMEOUT_MS', 60000, 1000);
const CONCURRENCY = readEnvInt('HOCKPAY_SMOKE_IDEMPOTENCY_CONCURRENCY', 6, 2);
const WITHDRAWAL_FEE = 199;
const runId = randomRunId();
const prisma = new PrismaClient();
let redis;
let currentStage = 'initializing';
let lastHttp;

function step(message) {
  currentStage = message;
  console.log(`[smoke:idempotency] ${message}`);
}

function apiPath(pathname) {
  return `${API_URL.replace(/\/$/, '')}${pathname}`;
}

function uniqueCpf(offset) {
  return buildCpf(`${Date.now()}${runId}${offset}${randomInt(1000, 9999)}`);
}

function uniqueEmail(label) {
  return `smoke-idempotency-${label}-${runId}@hockpay.local`;
}

function randomPassword() {
  return randomBytes(18).toString('base64url');
}

function apiKeyHeaders(ctx, extra = {}) {
  return {
    Authorization: `Bearer ${ctx.apiKeyPlainKey}`,
    ...extra,
  };
}

function jsonBody(payload) {
  return JSON.stringify(payload);
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
  const responseBody = text ? parseJson(text, `${method} ${pathname}`) : undefined;

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

async function createContext(label) {
  const cookieJar = createCookieJar();
  const password = randomPassword();
  const merchantDocument = uniqueCpf(label.length);
  const merchant = await requestJson('/merchants', {
    method: 'POST',
    cookieJar,
    body: jsonBody({
      name: `Idempotency ${label} Merchant ${runId}`,
      email: uniqueEmail(label),
      password,
      document: merchantDocument,
    }),
  });
  assert(merchant?.id, `${label}: merchant creation did not return id.`);

  const login = await requestJson('/auth/login', {
    method: 'POST',
    cookieJar,
    body: jsonBody({
      email: uniqueEmail(label),
      password,
    }),
  });
  assert(login?.accessToken, `${label}: login did not return access token.`);
  cookieJar.setFromAuthBody(login);

  const storeResult = await requestJson('/stores', {
    method: 'POST',
    cookieJar,
    jwtCookie: true,
    body: jsonBody({
      name: `Idempotency ${label} Store ${runId}`,
      slug: `idempotency-${label}-${runId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 50),
    }),
  });
  const storeId = storeResult?.store?.id;
  assert(storeId, `${label}: store creation did not return id.`);
  cookieJar.setFromAuthBody(storeResult);

  const account = await requestJson('/accounts/me', {
    cookieJar,
    jwtCookie: true,
  });
  const accountId = account?.account?.id;
  assert(account?.account?.storeId === storeId, `${label}: account did not match store.`);

  const apiKey = await requestJson('/api-keys', {
    method: 'POST',
    cookieJar,
    jwtCookie: true,
    body: jsonBody({
      name: `Idempotency ${label} TEST ${runId}`,
      environment: 'TEST',
    }),
  });
  assert(apiKey?.plainKey, `${label}: API key creation did not return plainKey.`);

  return {
    label,
    cookieJar,
    merchantDocument,
    storeId,
    accountId,
    apiKeyPlainKey: apiKey.plainKey,
  };
}

async function createPayment(ctx, input) {
  return requestJson('/payments', {
    method: 'POST',
    headers: apiKeyHeaders(ctx, { 'Idempotency-Key': input.idempotencyKey }),
    body: jsonBody(input.payload),
  });
}

async function createPaymentHttp(ctx, input, index) {
  return requestHttp('/payments', {
    method: 'POST',
    headers: apiKeyHeaders(ctx, {
      'Idempotency-Key': input.idempotencyKey,
      'x-request-id': `${input.idempotencyKey}-req-${index}`,
    }),
    body: jsonBody(input.payload),
  });
}

async function runConcurrentRequests(count, worker) {
  return Promise.all(Array.from({ length: count }, (_, index) => worker(index)));
}

function assertIdempotentHttpResponses(responses, selector, label, expectedKey) {
  const statuses = responses.map((response) => response.status);
  assert(
    statuses.every((status) => status === 201),
    `${label}: expected all responses to be 201, got ${statuses.join(', ')}`,
    { responses: responses.map(summarizeHttpResponse) },
  );

  const ids = responses.map((response) => selector(response.body));
  const uniqueIds = new Set(ids);
  assert(uniqueIds.size === 1, `${label}: expected one id, got ${[...uniqueIds].join(', ')}`);

  const firstBody = responses[0].body;
  for (const response of responses.slice(1)) {
    assertDeepEqual(
      response.body,
      firstBody,
      `${label}: replayed response body did not match the original response.`,
    );
  }

  const replayed = responses.map((response) => response.headers.get('x-idempotency-replayed'));
  assert(
    replayed.filter((value) => value === 'false').length === 1,
    `${label}: expected exactly one non-replayed response, got ${replayed.join(', ')}`,
  );
  assert(
    replayed.filter((value) => value === 'true').length === responses.length - 1,
    `${label}: expected remaining responses to be replayed, got ${replayed.join(', ')}`,
  );

  for (const response of responses) {
    assert(
      response.headers.get('x-idempotency-key') === expectedKey,
      `${label}: response did not echo idempotency key.`,
    );
  }

  return {
    id: ids[0],
    body: firstBody,
  };
}

function summarizeHttpResponse(response) {
  return {
    status: response.status,
    body: response.body,
    replayed: response.headers.get('x-idempotency-replayed'),
  };
}

function assertDeepEqual(actual, expected, message) {
  const actualJson = stableStringify(actual);
  const expectedJson = stableStringify(expected);
  assert(actualJson === expectedJson, message, {
    actual,
    expected,
  });
}

function stableStringify(value) {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === 'object') {
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

async function assertIdempotencyRecord(ctx, key, expectedStatus, expectedBody) {
  // A reserva e unica por key + store + environment desde a isolacao TEST/LIVE.
  const record = await prisma.idempotencyKey.findUnique({
    where: {
      key_storeId_environment: {
        key,
        storeId: ctx.storeId,
        environment: 'TEST',
      },
    },
  });

  assert(record, `Idempotency key ${key} was not stored.`);
  assert(record.status === 'COMPLETED', `Idempotency key ${key} was not completed.`);
  assert(record.responseStatus === expectedStatus, `Idempotency key ${key} responseStatus mismatch.`);

  if (expectedBody !== undefined) {
    assertDeepEqual(
      record.responseBody,
      expectedBody,
      `Idempotency key ${key} responseBody did not match the response DTO.`,
    );
  }

  return record;
}

async function assertPaymentDatabaseState(ctx, input, paymentId, options = {}) {
  const where = options.externalId
    ? { storeId: ctx.storeId, externalId: options.externalId }
    : { storeId: ctx.storeId, payerDocument: input.payload.customer.document };
  const payments = await prisma.payment.findMany({ where });
  assert(payments.length === 1, `${input.idempotencyKey}: expected one payment row, got ${payments.length}.`);
  assert(payments[0].id === paymentId, `${input.idempotencyKey}: payment id mismatch.`);

  const pixChargeCount = await prisma.pixCharge.count({
    where: {
      storeId: ctx.storeId,
      amount: input.payload.amount,
    },
  });
  assert(pixChargeCount === 1, `${input.idempotencyKey}: expected one PixCharge, got ${pixChargeCount}.`);

  const outboxCount = await prisma.outboxEvent.count({
    where: {
      aggregateType: 'Payment',
      aggregateId: paymentId,
      eventType: 'payment.created',
    },
  });
  assert(outboxCount === 1, `${input.idempotencyKey}: expected one payment.created outbox event.`);

  await assertIdempotencyRecord(ctx, input.idempotencyKey, 201, options.responseBody);
}

function paymentInput(ctx, scenario, overrides = {}) {
  return {
    idempotencyKey: `idempotency-${runId}-${scenario}`,
    payload: {
      amount: overrides.amount,
      externalId: overrides.externalId,
      description: `Idempotency ${scenario} ${runId}`,
      customer: {
        name: `Idempotency ${scenario} Customer`,
        email: `idempotency-${scenario}-${runId}@hockpay.local`,
        document: uniqueCpf(overrides.offset),
      },
      metadata: {
        smokeRunId: runId,
        scenario,
      },
    },
  };
}

async function assertConcurrentPaymentWithoutExternalId() {
  step('Creating concurrent payments without externalId');
  const ctx = await createContext('payments-a');
  const input = paymentInput(ctx, 'payment-no-external', {
    amount: 12345,
    offset: 101,
  });
  delete input.payload.externalId;

  const responses = await runConcurrentRequests(CONCURRENCY, (index) =>
    createPaymentHttp(ctx, input, index),
  );
  const paymentResult = assertIdempotentHttpResponses(
    responses,
    (body) => body?.payment?.id,
    'payments without externalId',
    input.idempotencyKey,
  );
  await assertPaymentDatabaseState(ctx, input, paymentResult.id, {
    responseBody: paymentResult.body,
  });
}

async function assertConcurrentPaymentWithExternalId() {
  step('Creating concurrent payments with externalId');
  const ctx = await createContext('payments-b');
  const input = paymentInput(ctx, 'payment-external', {
    amount: 23456,
    offset: 201,
    externalId: `idempotency-${runId}-external`,
  });

  const responses = await runConcurrentRequests(CONCURRENCY, (index) =>
    createPaymentHttp(ctx, input, index),
  );
  const paymentResult = assertIdempotentHttpResponses(
    responses,
    (body) => body?.payment?.id,
    'payments with externalId',
    input.idempotencyKey,
  );
  await assertPaymentDatabaseState(ctx, input, paymentResult.id, {
    externalId: input.payload.externalId,
    responseBody: paymentResult.body,
  });
}

async function assertPostgresReplayAndConflict() {
  step('Replaying payment from PostgreSQL after deleting Redis cache');
  const ctx = await createContext('payments-db-replay');
  const input = paymentInput(ctx, 'payment-db-replay', {
    amount: 34567,
    offset: 301,
    externalId: `idempotency-${runId}-db-replay`,
  });
  const created = await createPayment(ctx, input);
  const paymentId = created?.payment?.id;
  assert(paymentId, 'PostgreSQL replay setup did not create payment.');

  await deleteIdempotencyCache(ctx, input.idempotencyKey);

  const replay = await requestHttp('/payments', {
    method: 'POST',
    headers: apiKeyHeaders(ctx, { 'Idempotency-Key': input.idempotencyKey }),
    body: jsonBody(input.payload),
  });
  assert(replay.status === 201, `PostgreSQL replay expected 201, got ${replay.status}.`);
  assert(replay.headers.get('x-idempotency-replayed') === 'true', 'Replay after Redis delete was not marked as replayed.');
  assert(replay.body?.payment?.id === paymentId, 'Replay after Redis delete returned a different payment.');
  assertDeepEqual(replay.body, created, 'Replay after Redis delete did not return the persisted response DTO.');
  await assertPaymentDatabaseState(ctx, input, paymentId, {
    externalId: input.payload.externalId,
    responseBody: created,
  });

  step('Rejecting idempotency key conflicts');
  const changedBody = {
    ...input.payload,
    description: `${input.payload.description} changed`,
  };
  const conflict = await requestHttp('/payments', {
    method: 'POST',
    headers: apiKeyHeaders(ctx, { 'Idempotency-Key': input.idempotencyKey }),
    body: jsonBody(changedBody),
  });
  assert(conflict.status === 409, `Body conflict expected 409, got ${conflict.status}.`);
  assert(
    conflict.body?.error?.code === 'IDEMPOTENCY_KEY_CONFLICT',
    'Body conflict did not return IDEMPOTENCY_KEY_CONFLICT.',
  );

  const refundCountBeforePathConflict = await prisma.refund.count({
    where: { paymentId },
  });
  const refundTransactionCountBeforePathConflict = await prisma.transaction.count({
    where: {
      accountId: ctx.accountId,
      referenceType: 'REFUND',
    },
  });
  const refundOutboxCountBeforePathConflict = await prisma.outboxEvent.count({
    where: {
      aggregateType: 'Payment',
      aggregateId: paymentId,
      eventType: 'payment.refunded',
    },
  });
  const accountBeforePathConflict = await prisma.account.findUnique({
    where: { id: ctx.accountId },
  });

  // Estorno e JWT-only: com API key o guard responde 403 antes de a
  // idempotencia ser avaliada, e o conflito de path nunca apareceria.
  const pathConflict = await requestHttp('/refunds', {
    method: 'POST',
    cookieJar: ctx.cookieJar,
    jwtCookie: true,
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body: jsonBody({
      paymentId,
      amount: 100,
      reason: 'path conflict',
    }),
  });
  assert(pathConflict.status === 409, `Path conflict expected 409, got ${pathConflict.status}.`);
  assert(
    pathConflict.body?.error?.code === 'IDEMPOTENCY_KEY_CONFLICT',
    'Path conflict did not return IDEMPOTENCY_KEY_CONFLICT.',
  );

  const refundCountAfterPathConflict = await prisma.refund.count({
    where: { paymentId },
  });
  const refundTransactionCountAfterPathConflict = await prisma.transaction.count({
    where: {
      accountId: ctx.accountId,
      referenceType: 'REFUND',
    },
  });
  const refundOutboxCountAfterPathConflict = await prisma.outboxEvent.count({
    where: {
      aggregateType: 'Payment',
      aggregateId: paymentId,
      eventType: 'payment.refunded',
    },
  });
  const accountAfterPathConflict = await prisma.account.findUnique({
    where: { id: ctx.accountId },
  });
  assert(
    refundCountAfterPathConflict === refundCountBeforePathConflict,
    'Path conflict created refund rows.',
  );
  assert(
    refundTransactionCountAfterPathConflict === refundTransactionCountBeforePathConflict,
    'Path conflict created refund transactions.',
  );
  assert(
    refundOutboxCountAfterPathConflict === refundOutboxCountBeforePathConflict,
    'Path conflict created refund outbox events.',
  );
  assert(
    accountAfterPathConflict?.available === accountBeforePathConflict?.available &&
      accountAfterPathConflict?.pending === accountBeforePathConflict?.pending &&
      accountAfterPathConflict?.blocked === accountBeforePathConflict?.blocked,
    'Path conflict changed account balances.',
  );

  const paymentCount = await prisma.payment.count({
    where: {
      storeId: ctx.storeId,
      externalId: input.payload.externalId,
    },
  });
  assert(paymentCount === 1, 'Conflict requests created extra payments.');
}

async function createVerifiedBankAccount(ctx) {
  const bankAccount = await requestJson('/bank-accounts', {
    method: 'POST',
    cookieJar: ctx.cookieJar,
    jwtCookie: true,
    body: jsonBody({
      pixKey: ctx.merchantDocument,
      pixKeyType: 'CPF',
      holderName: `Idempotency Withdrawal Holder ${runId}`,
      holderDocument: ctx.merchantDocument,
      isDefault: true,
    }),
  });
  assert(bankAccount?.id, 'Bank account creation did not return id.');
  assert(bankAccount?.isVerified === true, 'Bank account should be verified.');
  return bankAccount;
}

async function createConfirmedPayment(ctx, scenario, amount) {
  const input = paymentInput(ctx, scenario, {
    amount,
    offset: randomInt(400, 999),
    externalId: `idempotency-${runId}-${scenario}`,
  });
  const created = await createPayment(ctx, input);
  assert(created?.payment?.id, `${scenario}: payment creation did not return id.`);
  const confirmed = await requestJson(`/dev/simulate/${created.payment.id}/confirm`, {
    method: 'POST',
    headers: apiKeyHeaders(ctx),
  });
  assert(confirmed?.payment?.status === 'CONFIRMED', `${scenario}: payment did not confirm.`);
  return confirmed.payment;
}

async function createReleasedPayment(ctx, scenario, amount) {
  const confirmed = await createConfirmedPayment(ctx, scenario, amount);
  const released = await requestJson(`/dev/simulate/${confirmed.id}/release`, {
    method: 'POST',
    headers: apiKeyHeaders(ctx),
  });
  assert(released?.payment?.status === 'RELEASED', `${scenario}: payment did not release.`);
  return released.payment;
}

async function assertConcurrentWithdrawal() {
  step('Creating concurrent withdrawals');
  const ctx = await createContext('withdrawals');
  const bankAccount = await createVerifiedBankAccount(ctx);
  const releasedPayment = await createReleasedPayment(ctx, 'withdrawal-funding', 100000);
  const accountBefore = await pollUntil(
    'released funding balance',
    () => requestJson('/accounts/me', { cookieJar: ctx.cookieJar, jwtCookie: true }),
    (result) => result?.account?.available === releasedPayment.netAmount,
    { timeoutMs: TIMEOUT_MS, intervalMs: 500 },
  );
  const initialAvailable = accountBefore.account.available;
  const amount = 30000;
  assert(initialAvailable >= amount, 'Funding payment did not create enough available balance.');

  const idempotencyKey = `idempotency-${runId}-withdrawal`;
  const payload = {
    bankAccountId: bankAccount.id,
    amount,
  };
  const responses = await runConcurrentRequests(CONCURRENCY, (index) =>
    requestHttp('/withdrawals', {
      method: 'POST',
      cookieJar: ctx.cookieJar,
      jwtCookie: true,
      headers: {
        'Idempotency-Key': idempotencyKey,
        'x-request-id': `${idempotencyKey}-req-${index}`,
      },
      body: jsonBody(payload),
    }),
  );
  const withdrawalResult = assertIdempotentHttpResponses(
    responses,
    (body) => body?.withdrawal?.id,
    'withdrawals',
    idempotencyKey,
  );
  const withdrawalId = withdrawalResult.id;

  const withdrawals = await prisma.withdrawal.findMany({
    where: {
      accountId: ctx.accountId,
      amount,
    },
  });
  assert(withdrawals.length === 1, `Expected one withdrawal row, got ${withdrawals.length}.`);
  assert(withdrawals[0].id === withdrawalId, 'Withdrawal id mismatch.');
  assert(withdrawals[0].fee === WITHDRAWAL_FEE, 'Withdrawal fee mismatch.');
  assert(withdrawals[0].netAmount === amount - WITHDRAWAL_FEE, 'Withdrawal net amount mismatch.');

  const transactionCount = await prisma.transaction.count({
    where: {
      accountId: ctx.accountId,
      type: 'WITHDRAWAL_RESERVED',
      referenceType: 'WITHDRAWAL',
      referenceId: withdrawalId,
    },
  });
  assert(transactionCount === 1, `Expected one withdrawal transaction, got ${transactionCount}.`);

  const account = await prisma.account.findUnique({ where: { id: ctx.accountId } });
  assert(account?.available === initialAvailable - amount, 'Available balance was not reserved once.');
  assert(account?.blocked === amount, 'Blocked balance was not reserved once.');
  assert(account?.pending === 0, 'Pending balance changed during withdrawal.');

  const outboxCount = await prisma.outboxEvent.count({
    where: {
      aggregateType: 'Withdrawal',
      aggregateId: withdrawalId,
      eventType: 'withdrawal.created',
    },
  });
  assert(outboxCount === 1, 'Expected one withdrawal.created outbox event.');
  await assertIdempotencyRecord(ctx, idempotencyKey, 201, withdrawalResult.body);
}

async function assertConcurrentRefund() {
  step('Creating concurrent refunds');
  const ctx = await createContext('refunds');
  const payment = await createConfirmedPayment(ctx, 'refund-base', 50000);
  const accountBefore = await requestJson('/accounts/me', {
    cookieJar: ctx.cookieJar,
    jwtCookie: true,
  });
  const initialPending = accountBefore.account.pending;
  const initialAvailable = accountBefore.account.available;
  const amount = 10000;
  const expectedFeeRefunded = Math.round(payment.fee * (amount / payment.amount));
  const expectedDeduction = amount - expectedFeeRefunded;
  const idempotencyKey = `idempotency-${runId}-refund`;
  const payload = {
    paymentId: payment.id,
    amount,
    reason: `Idempotency concurrent refund ${runId}`,
  };

  const responses = await runConcurrentRequests(CONCURRENCY, (index) =>
    requestHttp('/refunds', {
      method: 'POST',
      cookieJar: ctx.cookieJar,
      jwtCookie: true,
      headers: {
        'Idempotency-Key': idempotencyKey,
        'x-request-id': `${idempotencyKey}-req-${index}`,
      },
      body: jsonBody(payload),
    }),
  );
  const refundResult = assertIdempotentHttpResponses(
    responses,
    (body) => body?.refund?.id,
    'refunds',
    idempotencyKey,
  );
  const refundId = refundResult.id;

  const refunds = await prisma.refund.findMany({
    where: {
      paymentId: payment.id,
    },
  });
  assert(refunds.length === 1, `Expected one refund row, got ${refunds.length}.`);
  assert(refunds[0].id === refundId, 'Refund id mismatch.');
  assert(refunds[0].feeRefunded === expectedFeeRefunded, 'Refund fee refunded mismatch.');

  const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
  assert(updatedPayment?.totalRefunded === amount, 'Payment totalRefunded was not incremented once.');

  const transactionCount = await prisma.transaction.count({
    where: {
      accountId: ctx.accountId,
      type: 'REFUND_DEDUCTED',
      referenceType: 'REFUND',
      referenceId: refundId,
    },
  });
  assert(transactionCount === 1, `Expected one refund transaction, got ${transactionCount}.`);

  const account = await prisma.account.findUnique({ where: { id: ctx.accountId } });
  assert(account?.pending === initialPending - expectedDeduction, 'Pending balance was not deducted once.');
  assert(account?.available === initialAvailable, 'Available balance changed for confirmed payment refund.');

  const outboxCount = await prisma.outboxEvent.count({
    where: {
      aggregateType: 'Payment',
      aggregateId: payment.id,
      eventType: 'payment.refunded',
    },
  });
  assert(outboxCount === 1, 'Expected one payment.refunded outbox event.');
  await assertIdempotencyRecord(ctx, idempotencyKey, 201, refundResult.body);
}

async function deleteIdempotencyCache(ctx, idempotencyKey) {
  redis ??= new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: null,
  });
  if (redis.status === 'wait') {
    await redis.connect();
  }

  const cacheKey = sha256(`${idempotencyKey}:${ctx.storeId}`);
  await redis.del(`idempotency:v2:${cacheKey}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  await prisma.$connect();
  try {
    step('Checking API readiness');
    const health = await requestJson('/health/ready');
    assert(health?.status === 'ok', 'Health ready endpoint did not return status=ok.');

    await assertConcurrentPaymentWithoutExternalId();
    await assertConcurrentPaymentWithExternalId();
    await assertPostgresReplayAndConflict();
    await assertConcurrentWithdrawal();
    await assertConcurrentRefund();

    step('Completed idempotency concurrency smoke');
  } finally {
    await redis?.quit();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(
    `[smoke:idempotency] FAILED: ${error instanceof Error ? error.message : String(error)}`,
  );
  if (error instanceof SmokeError && error.details) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exitCode = 1;
});
