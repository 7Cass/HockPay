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
  // A fila e do worker inteiro, e as outras suites deixam saques pendentes nela.
  // Datando o saque no passado ele vira o primeiro candidato do ORDER BY
  // created_at, entao os dois claimers disputam esta linha e nao duas quaisquer.
  const seededAt = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const withdrawal = await prisma.withdrawal.create({
    data: {
      accountId: ctx.accountId,
      bankAccountId: ctx.bankAccountId,
      amount,
      fee: WITHDRAWAL_FEE,
      netAmount: amount - WITHDRAWAL_FEE,
      status: WithdrawalStatus.PENDING,
      createdAt: seededAt,
      updatedAt: seededAt,
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
  const claimedIds = claimed.map((row) => row.id);
  // SKIP LOCKED nao promete que o perdedor saia de maos vazias — ele pula para o
  // proximo candidato. O que ele promete, e o que importa aqui, e que a mesma
  // linha nunca sai para dois claimers.
  assert(
    new Set(claimedIds).size === claimedIds.length,
    'No withdrawal should be claimed by both claimers.',
    { claims },
  );
  assert(
    claimedIds.filter((id) => id === withdrawal.id).length === 1,
    'The seeded withdrawal should be claimed exactly once.',
    { claims, withdrawalId: withdrawal.id },
  );

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

async function runCheckoutRollbackWithTrigger(ctx) {
  step('Forcing checkout fulfill rollback through a temporary PostgreSQL trigger');
  const rollbackSmokeRunId = `checkout-rollback-${runId}`;
  const requestId = `smoke-checkout-rollback-${runId}`;
  const triggerNames = checkoutRollbackTriggerNames();
  const created = await createGuestCheckoutSession(ctx, {
    amount: 2111,
    label: 'rollback',
    metadata: {
      smokeRunId: runId,
      checkoutRollbackSmokeRunId: rollbackSmokeRunId,
      checkoutRollbackSmokeRequestId: requestId,
      source: 'db-concurrency-checkout-rollback',
    },
  });
  const pixChargeCountBefore = await countPixChargesForStore(ctx.storeId);
  let response;

  try {
    await installCheckoutRollbackTrigger({
      ...triggerNames,
      rollbackSmokeRunId,
    });
    response = await fulfillCheckoutSessionHttp(created.checkoutToken, {
      requestId,
      customer: {
        name: 'DB Concurrency Checkout Rollback',
        email: uniqueEmail('checkout-rollback-customer'),
      },
    });
  } finally {
    await dropCheckoutRollbackTrigger(triggerNames);
  }

  // Um trigger estourando e falha de servidor, nao regra de negocio: a API
  // responde 500 com o envelope DATABASE_ERROR e guarda a mensagem do Postgres
  // no log, sem devolve-la ao cliente.
  assert(
    response?.status === 500 && response.body?.error?.code === 'DATABASE_ERROR',
    'Checkout rollback trigger should make fulfill fail as a database error.',
    { response: response ? summarizeHttpResponse(response) : undefined },
  );
  assert(
    typeof response.body?.error?.requestId === 'string',
    'Database error response should carry the requestId that finds it in the log.',
    { response: summarizeHttpResponse(response) },
  );
  // A prova de que payment, Pix charge e outbox existiam dentro da transacao
  // fica no proprio trigger: ele so forca o rollback depois de conferir as tres
  // linhas, e levanta uma mensagem diferente quando elas nao estao la. O que
  // sobra para observar daqui e o estado depois do rollback.

  const session = await prisma.checkoutSession.findUnique({
    where: { checkoutToken: created.checkoutToken },
    select: { id: true, status: true, paymentId: true, metadata: true },
  });
  assert(session?.status === 'OPEN', 'Rolled-back checkout session should remain OPEN.', {
    session,
  });
  assert(session?.paymentId === null, 'Rolled-back checkout session should not keep a paymentId.', {
    session,
  });

  const paymentCount = await countPaymentsByMetadata(
    ctx.storeId,
    'checkoutRollbackSmokeRunId',
    rollbackSmokeRunId,
  );
  assert(paymentCount === 0, 'Rolled-back checkout fulfill should not leave a payment.', {
    paymentCount,
    rollbackSmokeRunId,
  });

  const outboxCount = await prisma.outboxEvent.count({
    where: {
      requestId,
      eventType: 'payment.created',
    },
  });
  assert(outboxCount === 0, 'Rolled-back checkout fulfill should not leave a payment.created outbox event.', {
    outboxCount,
    requestId,
  });

  const pixChargeCountAfter = await countPixChargesForStore(ctx.storeId);
  assert(
    pixChargeCountAfter === pixChargeCountBefore,
    'Rolled-back checkout fulfill should restore the store Pix charge count.',
    {
      pixChargeCountBefore,
      pixChargeCountAfter,
    },
  );
}

async function runConcurrentCheckoutFulfill(ctx) {
  step('Fulfilling the same guest checkout session concurrently');
  const fulfillSmokeRunId = `checkout-double-fulfill-${runId}`;
  const created = await createGuestCheckoutSession(ctx, {
    amount: 3222,
    label: 'double-fulfill',
    metadata: {
      smokeRunId: runId,
      checkoutConcurrentFulfillSmokeRunId: fulfillSmokeRunId,
      source: 'db-concurrency-checkout-double-fulfill',
    },
  });
  const requestIds = [
    `smoke-checkout-double-fulfill-a-${runId}`,
    `smoke-checkout-double-fulfill-b-${runId}`,
  ];
  const responses = await Promise.all([
    fulfillCheckoutSessionHttp(created.checkoutToken, {
      requestId: requestIds[0],
      customer: {
        name: 'DB Concurrency Checkout A',
        email: uniqueEmail('checkout-double-a'),
      },
    }),
    fulfillCheckoutSessionHttp(created.checkoutToken, {
      requestId: requestIds[1],
      customer: {
        name: 'DB Concurrency Checkout B',
        email: uniqueEmail('checkout-double-b'),
      },
    }),
  ]);
  const successful = responses.filter((result) => result.status === 200 && result.body?.paymentId);

  // Quem perde a corrida recebe o pagamento de quem ganhou, nao um erro: e o
  // que faz o comprador que envia o checkout duas vezes ver a compra dele. O
  // invariante nao e "uma resposta boa", e "um pagamento so".
  assert(successful.length === responses.length, 'Concurrent checkout fulfill should answer every caller.', {
    responses: responses.map(summarizeHttpResponse),
  });
  const settledPaymentIds = new Set(successful.map((result) => result.body.paymentId));
  assert(
    settledPaymentIds.size === 1,
    'Concurrent checkout fulfill should settle on a single payment.',
    { responses: responses.map(summarizeHttpResponse) },
  );

  const paymentId = successful[0].body.paymentId;
  assert(paymentId, 'Successful concurrent checkout fulfill did not return a paymentId.', {
    response: summarizeHttpResponse(successful[0]),
  });

  const session = await prisma.checkoutSession.findUnique({
    where: { checkoutToken: created.checkoutToken },
    select: { id: true, status: true, paymentId: true },
  });
  assert(
    session?.status === 'COMPLETED' && session.paymentId === paymentId,
    'Concurrent checkout fulfill should leave one completed session linked to the successful payment.',
    { session, paymentId },
  );

  const completedSessionCount = await prisma.checkoutSession.count({
    where: {
      checkoutToken: created.checkoutToken,
      status: 'COMPLETED',
      paymentId,
    },
  });
  assert(completedSessionCount === 1, 'Concurrent checkout fulfill should complete exactly one session.', {
    completedSessionCount,
    checkoutToken: created.checkoutToken,
  });

  const paymentCount = await countPaymentsByMetadata(
    ctx.storeId,
    'checkoutConcurrentFulfillSmokeRunId',
    fulfillSmokeRunId,
  );
  assert(paymentCount === 1, 'Concurrent checkout fulfill should create exactly one payment.', {
    paymentCount,
    fulfillSmokeRunId,
  });

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      storeId: true,
      pixChargeId: true,
      metadata: true,
    },
  });
  assert(
    payment?.storeId === ctx.storeId &&
      payment.pixChargeId &&
      payment.metadata?.checkoutConcurrentFulfillSmokeRunId === fulfillSmokeRunId,
    'Concurrent checkout fulfill payment row mismatch.',
    { payment, paymentId, fulfillSmokeRunId },
  );

  const pixChargeCount = await prisma.pixCharge.count({
    where: {
      id: payment.pixChargeId,
      storeId: ctx.storeId,
    },
  });
  assert(pixChargeCount === 1, 'Concurrent checkout fulfill should create one Pix charge linked to the payment.', {
    pixChargeCount,
    pixChargeId: payment.pixChargeId,
  });

  const paymentCreatedOutboxCount = await prisma.outboxEvent.count({
    where: {
      aggregateType: 'Payment',
      aggregateId: paymentId,
      eventType: 'payment.created',
    },
  });
  assert(
    paymentCreatedOutboxCount === 1,
    'Concurrent checkout fulfill should create one payment.created outbox event.',
    {
      paymentCreatedOutboxCount,
      paymentId,
    },
  );

  const requestOutboxCount = await prisma.outboxEvent.count({
    where: {
      requestId: { in: requestIds },
      eventType: 'payment.created',
    },
  });
  assert(requestOutboxCount === 1, 'Concurrent checkout fulfill should persist payment.created for one request only.', {
    requestOutboxCount,
    requestIds,
  });
}

async function createGuestCheckoutSession(ctx, input) {
  const created = await requestJson('/checkout-sessions', {
    method: 'POST',
    cookieJar: ctx.cookieJar,
    jwtCookie: true,
    headers: {
      'Idempotency-Key': `db-concurrency-${runId}-checkout-${input.label}`,
    },
    body: jsonBody({
      amount: input.amount,
      description: `DB concurrency checkout ${input.label}`,
      customerCollectionMode: 'GUEST',
      successUrl: 'http://127.0.0.1/smoke-checkout/success',
      cancelUrl: 'http://127.0.0.1/smoke-checkout/cancel',
      expiresInSeconds: 3600,
      metadata: input.metadata,
    }),
  });
  assert(created?.id && created?.checkoutToken, 'Checkout session creation did not return id and checkoutToken.', {
    created,
    label: input.label,
  });

  return created;
}

function fulfillCheckoutSessionHttp(checkoutToken, input) {
  return requestHttp(`/checkout-sessions/${checkoutToken}/fulfill`, {
    method: 'POST',
    headers: {
      'x-request-id': input.requestId,
    },
    body: jsonBody({
      customer: input.customer,
    }),
  });
}

function checkoutRollbackTriggerNames() {
  const suffix = runId.replace(/[^a-zA-Z0-9_]/g, '_');
  return {
    functionName: `smoke_checkout_rollback_fn_${suffix}`,
    triggerName: `smoke_checkout_rollback_trg_${suffix}`,
  };
}

async function installCheckoutRollbackTrigger({
  functionName,
  triggerName,
  rollbackSmokeRunId,
}) {
  await dropCheckoutRollbackTrigger({ functionName, triggerName });

  const functionIdentifier = quoteSqlIdentifier(functionName);
  const triggerIdentifier = quoteSqlIdentifier(triggerName);
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION ${functionIdentifier}()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $smoke_checkout_rollback$
    DECLARE
      expected_request_id text;
      payment_count integer;
      pix_charge_count integer;
      outbox_count integer;
    BEGIN
      IF TG_OP = 'UPDATE'
        AND NEW.status::text = 'COMPLETED'
        AND OLD.status::text <> 'COMPLETED'
        AND NEW.payment_id IS NOT NULL
        AND NEW.metadata ->> 'checkoutRollbackSmokeRunId' = ${sqlStringLiteral(rollbackSmokeRunId)}
      THEN
        expected_request_id := NEW.metadata ->> 'checkoutRollbackSmokeRequestId';

        SELECT COUNT(*) INTO payment_count
        FROM payments
        WHERE id = NEW.payment_id;

        SELECT COUNT(*) INTO pix_charge_count
        FROM payments p
        INNER JOIN pix_charges pc ON pc.id = p.pix_charge_id
        WHERE p.id = NEW.payment_id;

        SELECT COUNT(*) INTO outbox_count
        FROM outbox_events
        WHERE aggregate_type = 'Payment'
          AND aggregate_id = NEW.payment_id
          AND event_type = 'payment.created'
          AND request_id = expected_request_id;

        IF payment_count <> 1 OR pix_charge_count <> 1 OR outbox_count <> 1 THEN
          RAISE EXCEPTION
            'checkout rollback smoke expected visible writes payment=% pix_charge=% outbox=%',
            payment_count,
            pix_charge_count,
            outbox_count;
        END IF;

        RAISE EXCEPTION
          'checkout rollback smoke forced rollback payment=% pix_charge=% outbox=%',
          payment_count,
          pix_charge_count,
          outbox_count;
      END IF;

      RETURN NEW;
    END;
    $smoke_checkout_rollback$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER ${triggerIdentifier}
    BEFORE UPDATE ON checkout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION ${functionIdentifier}();
  `);
}

async function dropCheckoutRollbackTrigger({ functionName, triggerName }) {
  const functionIdentifier = quoteSqlIdentifier(functionName);
  const triggerIdentifier = quoteSqlIdentifier(triggerName);

  await prisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS ${triggerIdentifier} ON checkout_sessions;
  `);
  await prisma.$executeRawUnsafe(`
    DROP FUNCTION IF EXISTS ${functionIdentifier}();
  `);
}

function quoteSqlIdentifier(identifier) {
  assert(
    /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier),
    'Unsafe SQL identifier for checkout rollback trigger.',
    { identifier },
  );
  return `"${identifier}"`;
}

function sqlStringLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function countPaymentsByMetadata(storeId, key, value) {
  return prisma.payment.count({
    where: {
      storeId,
      metadata: {
        path: [key],
        equals: value,
      },
    },
  });
}

async function countPixChargesForStore(storeId) {
  return prisma.pixCharge.count({
    where: { storeId },
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
  await runCheckoutRollbackWithTrigger(ctx);
  await runConcurrentCheckoutFulfill(ctx);
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
