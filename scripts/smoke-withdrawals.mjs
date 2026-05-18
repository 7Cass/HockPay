#!/usr/bin/env node
import { randomBytes, randomInt } from 'node:crypto';
import {
  SmokeError,
  assert,
  buildCpf,
  createApiClient,
  createCookieJar,
  formatError,
  pollUntil,
  randomRunId,
} from './smoke/lib/smoke-utils.mjs';

const API_URL = process.env.HOCKPAY_API_URL ?? 'http://localhost:3000/api/v1';
const DASHBOARD_URL = process.env.HOCKPAY_DASHBOARD_URL ?? 'http://localhost:4200';
const TIMEOUT_MS = Number(process.env.HOCKPAY_SMOKE_TIMEOUT_MS ?? 60000);
const POLL_INTERVAL_MS = 500;
const WITHDRAWAL_FEE = 199;
const FIRST_WITHDRAWAL_AMOUNT = 30000;
const SECOND_WITHDRAWAL_AMOUNT = 20000;
const FUNDING_PAYMENT_AMOUNT = 100000;

const runId = randomRunId();
const cookieJar = createCookieJar();
const api = createApiClient(API_URL, { cookieJar, timeoutMs: TIMEOUT_MS });

const state = {
  merchantId: undefined,
  merchantEmail: `smoke-withdrawals-${runId}@hockpay.local`,
  merchantPassword: randomPassword(),
  merchantDocument: buildCpf(`${Date.now()}${randomInt(1000, 9999)}`),
  storeId: undefined,
  apiKeyPrefix: undefined,
  apiKeyPlainKey: undefined,
  accountId: undefined,
  bankAccountId: undefined,
  fundingPaymentId: undefined,
  completedWithdrawalId: undefined,
  failedWithdrawalId: undefined,
};

function step(message) {
  console.log(`[smoke:withdrawals] ${message}`);
}

function randomPassword() {
  return randomBytes(18).toString('base64url');
}

function apiKeyHeaders(apiKey, extra = {}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...extra,
  };
}

function query(pathname, params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const suffix = search.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

async function requestJson(pathname, options = {}) {
  return api.requestJson(pathname, options);
}

async function createMerchantStoreAndApiKey() {
  const merchant = await requestJson('/merchants', {
    method: 'POST',
    body: JSON.stringify({
      name: `Withdrawals Smoke Merchant ${runId}`,
      email: state.merchantEmail,
      password: state.merchantPassword,
      document: state.merchantDocument,
    }),
  });
  state.merchantId = merchant?.id;
  assert(state.merchantId, 'Merchant creation did not return an id.');

  const login = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: state.merchantEmail,
      password: state.merchantPassword,
    }),
  });
  assert(login?.accessToken, 'Login did not return an access token.');
  cookieJar.setFromAuthBody(login);

  const storeResult = await requestJson('/stores', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      name: `Withdrawals Smoke Store ${runId}`,
      slug: `withdrawals-smoke-${runId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 50),
    }),
  });
  state.storeId = storeResult?.store?.id;
  assert(state.storeId, 'Store creation did not return a store id.');
  cookieJar.setFromAuthBody(storeResult);

  const account = await requestJson('/accounts/me', { jwtCookie: true });
  state.accountId = account?.account?.id;
  assert(account?.account?.storeId === state.storeId, 'Account lookup did not match the created store.');

  const apiKey = await requestJson('/api-keys', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      name: `Withdrawals Smoke TEST ${runId}`,
      environment: 'TEST',
    }),
  });
  state.apiKeyPrefix = apiKey?.prefix;
  state.apiKeyPlainKey = apiKey?.plainKey;
  assert(state.apiKeyPlainKey, 'API key creation did not return plainKey.');
}

async function createVerifiedPixAccount() {
  const bankAccount = await requestJson('/bank-accounts', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      pixKey: state.merchantDocument,
      pixKeyType: 'CPF',
      holderName: `Withdrawals Smoke Merchant ${runId}`,
      holderDocument: state.merchantDocument,
      isDefault: true,
    }),
  });
  state.bankAccountId = bankAccount?.id;
  assert(state.bankAccountId, 'Bank account creation did not return an id.');
  assert(bankAccount?.isVerified === true, 'Bank account should be auto-verified when CPF matches merchant document.');

  const bankAccounts = await requestJson('/bank-accounts', { jwtCookie: true });
  assert(
    bankAccounts?.some((item) => item.id === state.bankAccountId && item.isVerified === true),
    'Bank account list did not include the verified Pix account.',
  );
}

async function fundAvailableBalance() {
  const customerDocument = buildCpf(`${Date.now()}${randomInt(1000, 9999)}`);
  const payment = await requestJson('/payments', {
    method: 'POST',
    headers: apiKeyHeaders(state.apiKeyPlainKey, {
      'Idempotency-Key': `withdrawals-${runId}-funding-payment`,
    }),
    body: JSON.stringify({
      externalId: `withdrawals-${runId}-funding-payment`,
      amount: FUNDING_PAYMENT_AMOUNT,
      description: 'Withdrawals smoke funding payment',
      customer: {
        name: 'Withdrawals Smoke Customer',
        email: `withdrawals-customer-${runId}@hockpay.local`,
        document: customerDocument,
      },
      metadata: {
        smokeRunId: runId,
        source: 'withdrawals',
      },
    }),
  });
  state.fundingPaymentId = payment?.payment?.id;
  assert(state.fundingPaymentId, 'Funding payment creation did not return a payment id.');

  await requestJson(`/dev/simulate/${state.fundingPaymentId}/confirm`, {
    method: 'POST',
    headers: apiKeyHeaders(state.apiKeyPlainKey),
  });
  await requestJson(`/dev/simulate/${state.fundingPaymentId}/release`, {
    method: 'POST',
    headers: apiKeyHeaders(state.apiKeyPlainKey),
  });

  const releasedPayment = await requestJson(`/payments/${state.fundingPaymentId}`, {
    headers: apiKeyHeaders(state.apiKeyPlainKey),
  });
  assert(releasedPayment?.payment?.status === 'RELEASED', 'Funding payment should be RELEASED.');

  const account = await pollUntil(
    'Released funding balance',
    () => requestJson('/accounts/me', { jwtCookie: true }),
    (result) => result?.account?.available === releasedPayment.payment.netAmount,
    { timeoutMs: TIMEOUT_MS, intervalMs: POLL_INTERVAL_MS },
  );
  assert(account?.account?.pending === 0, 'Funding payment should leave no pending balance after release.');

  return {
    account: account.account,
    payment: releasedPayment.payment,
  };
}

async function createWithdrawal(amount, idempotencyKey) {
  const result = await requestJson('/withdrawals', {
    method: 'POST',
    jwtCookie: true,
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      bankAccountId: state.bankAccountId,
      amount,
    }),
  });
  assert(result?.withdrawal?.id, 'Withdrawal creation did not return an id.');
  return result.withdrawal;
}

async function validateCreatedWithdrawal(withdrawal, amount, expectedBalances) {
  assert(withdrawal.status === 'PENDING', `Withdrawal ${withdrawal.id} should start as PENDING.`);
  assert(withdrawal.amount === amount, `Withdrawal ${withdrawal.id} amount mismatch.`);
  assert(withdrawal.fee === WITHDRAWAL_FEE, `Withdrawal ${withdrawal.id} fee should be ${WITHDRAWAL_FEE}.`);
  assert(
    withdrawal.netAmount === amount - WITHDRAWAL_FEE,
    `Withdrawal ${withdrawal.id} netAmount should be amount minus fee.`,
  );
  assert(withdrawal.bankAccountId === state.bankAccountId, `Withdrawal ${withdrawal.id} bank account mismatch.`);

  const account = await requestJson('/accounts/me', { jwtCookie: true });
  assert(account?.account?.available === expectedBalances.available, 'Available balance mismatch after reserve.');
  assert(account?.account?.blocked === expectedBalances.blocked, 'Blocked balance mismatch after reserve.');
  return account.account;
}

async function validateWithdrawalLookups(withdrawal) {
  const detail = await requestJson(`/withdrawals/${withdrawal.id}`, { jwtCookie: true });
  assert(detail?.withdrawal?.id === withdrawal.id, 'Withdrawal detail returned an unexpected id.');

  const list = await requestJson('/withdrawals?limit=20', { jwtCookie: true });
  assert(
    list?.withdrawals?.some((item) => item.id === withdrawal.id),
    'Withdrawal list did not include the created withdrawal.',
  );

  const byStatus = await requestJson(query('/withdrawals', { status: withdrawal.status, limit: 20 }), {
    jwtCookie: true,
  });
  assert(
    byStatus?.withdrawals?.some((item) => item.id === withdrawal.id),
    'Withdrawal status filter did not include the created withdrawal.',
  );

  const byBankAccount = await requestJson(
    query('/withdrawals', { bankAccountId: state.bankAccountId, limit: 20 }),
    { jwtCookie: true },
  );
  assert(
    byBankAccount?.withdrawals?.some((item) => item.id === withdrawal.id),
    'Withdrawal bankAccountId filter did not include the created withdrawal.',
  );

  const startDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const endDate = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const byPeriod = await requestJson(query('/withdrawals', { startDate, endDate, limit: 20 }), {
    jwtCookie: true,
  });
  assert(
    byPeriod?.withdrawals?.some((item) => item.id === withdrawal.id),
    'Withdrawal period filter did not include the created withdrawal.',
  );
}

async function completeWithdrawal(withdrawalId, expectedBalances) {
  const completed = await requestJson(`/dev/withdrawals/${withdrawalId}/complete`, {
    method: 'POST',
    jwtCookie: true,
  });
  const withdrawal = completed?.withdrawal;
  assert(withdrawal?.id === withdrawalId, 'Complete endpoint returned an unexpected withdrawal.');
  assert(withdrawal.status === 'COMPLETED', 'Completed withdrawal should have status COMPLETED.');
  assert(withdrawal.pixE2eId, 'Completed withdrawal should include pixE2eId.');
  assert(withdrawal.paidAt, 'Completed withdrawal should include paidAt.');

  const account = await requestJson('/accounts/me', { jwtCookie: true });
  assert(account?.account?.available === expectedBalances.available, 'Available balance mismatch after completion.');
  assert(account?.account?.blocked === expectedBalances.blocked, 'Blocked balance mismatch after completion.');

  return withdrawal;
}

async function failWithdrawal(withdrawalId, expectedBalances, reason) {
  const failed = await requestJson(`/dev/withdrawals/${withdrawalId}/fail`, {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({ reason }),
  });
  const withdrawal = failed?.withdrawal;
  assert(withdrawal?.id === withdrawalId, 'Fail endpoint returned an unexpected withdrawal.');
  assert(withdrawal.status === 'FAILED', 'Failed withdrawal should have status FAILED.');
  assert(withdrawal.failedReason === reason, 'Failed withdrawal reason mismatch.');

  const account = await requestJson('/accounts/me', { jwtCookie: true });
  assert(account?.account?.available === expectedBalances.available, 'Available balance mismatch after failure.');
  assert(account?.account?.blocked === expectedBalances.blocked, 'Blocked balance mismatch after failure.');

  return withdrawal;
}

async function validateLedger(completedWithdrawal, failedWithdrawal) {
  const expected = [
    {
      type: 'WITHDRAWAL_RESERVED',
      referenceId: completedWithdrawal.id,
      amount: completedWithdrawal.amount,
      fee: completedWithdrawal.fee,
      netAmount: completedWithdrawal.netAmount,
    },
    {
      type: 'WITHDRAWAL_SENT',
      referenceId: completedWithdrawal.id,
      amount: completedWithdrawal.amount,
      fee: completedWithdrawal.fee,
      netAmount: completedWithdrawal.netAmount,
    },
    {
      type: 'WITHDRAWAL_RESERVED',
      referenceId: failedWithdrawal.id,
      amount: failedWithdrawal.amount,
      fee: failedWithdrawal.fee,
      netAmount: failedWithdrawal.netAmount,
    },
    {
      type: 'WITHDRAWAL_REVERSED',
      referenceId: failedWithdrawal.id,
      amount: failedWithdrawal.amount,
      fee: 0,
      netAmount: failedWithdrawal.amount,
    },
  ];

  const transactions = await requestJson('/transactions?limit=50', { jwtCookie: true });
  assert(Array.isArray(transactions?.data), 'Transaction list did not return data array.');

  for (const expectedTransaction of expected) {
    const found = transactions.data.find(
      (transaction) =>
        transaction.type === expectedTransaction.type &&
        transaction.referenceType === 'WITHDRAWAL' &&
        transaction.referenceId === expectedTransaction.referenceId,
    );
    assert(found, `Missing ledger transaction ${expectedTransaction.type} for ${expectedTransaction.referenceId}.`);
    assert(found.amount === expectedTransaction.amount, `${expectedTransaction.type} amount mismatch.`);
    assert(found.fee === expectedTransaction.fee, `${expectedTransaction.type} fee mismatch.`);
    assert(found.netAmount === expectedTransaction.netAmount, `${expectedTransaction.type} netAmount mismatch.`);
  }
}

async function run() {
  step(`Using API ${API_URL}`);
  const live = await requestJson('/health/live');
  const ready = await requestJson('/health/ready');
  assert(live?.status === 'ok', 'Health live endpoint did not return status=ok.');
  assert(ready?.status === 'ok', 'Health ready endpoint did not return status=ok.');

  step('Creating merchant, store, and TEST API key');
  await createMerchantStoreAndApiKey();

  step('Creating verified Pix account');
  await createVerifiedPixAccount();

  step('Creating and releasing funding payment');
  const funded = await fundAvailableBalance();
  const initialAvailable = funded.account.available;
  assert(
    initialAvailable >= FIRST_WITHDRAWAL_AMOUNT + SECOND_WITHDRAWAL_AMOUNT,
    `Funding payment did not create enough available balance. Got ${initialAvailable}.`,
  );

  step('Creating first withdrawal and validating reserve');
  const firstWithdrawal = await createWithdrawal(
    FIRST_WITHDRAWAL_AMOUNT,
    `withdrawals-${runId}-first`,
  );
  state.completedWithdrawalId = firstWithdrawal.id;
  const replay = await createWithdrawal(FIRST_WITHDRAWAL_AMOUNT, `withdrawals-${runId}-first`);
  assert(replay.id === firstWithdrawal.id, 'Withdrawal idempotency replay returned a different id.');
  await validateCreatedWithdrawal(firstWithdrawal, FIRST_WITHDRAWAL_AMOUNT, {
    available: initialAvailable - FIRST_WITHDRAWAL_AMOUNT,
    blocked: FIRST_WITHDRAWAL_AMOUNT,
  });
  await validateWithdrawalLookups(firstWithdrawal);

  step('Completing first withdrawal');
  const completedWithdrawal = await completeWithdrawal(firstWithdrawal.id, {
    available: initialAvailable - FIRST_WITHDRAWAL_AMOUNT,
    blocked: 0,
  });

  step('Creating second withdrawal and validating reserve');
  const secondWithdrawal = await createWithdrawal(
    SECOND_WITHDRAWAL_AMOUNT,
    `withdrawals-${runId}-second`,
  );
  state.failedWithdrawalId = secondWithdrawal.id;
  await validateCreatedWithdrawal(secondWithdrawal, SECOND_WITHDRAWAL_AMOUNT, {
    available: initialAvailable - FIRST_WITHDRAWAL_AMOUNT - SECOND_WITHDRAWAL_AMOUNT,
    blocked: SECOND_WITHDRAWAL_AMOUNT,
  });
  await validateWithdrawalLookups(secondWithdrawal);

  step('Failing second withdrawal');
  const failureReason = `withdrawals smoke simulated failure ${runId}`;
  const failedWithdrawal = await failWithdrawal(secondWithdrawal.id, {
    available: initialAvailable - FIRST_WITHDRAWAL_AMOUNT,
    blocked: 0,
  }, failureReason);

  step('Validating final listing and ledger entries');
  const completedList = await requestJson('/withdrawals?status=COMPLETED&limit=20', { jwtCookie: true });
  assert(
    completedList?.withdrawals?.some((item) => item.id === completedWithdrawal.id),
    'Completed withdrawal list did not include the completed withdrawal.',
  );
  const failedList = await requestJson('/withdrawals?status=FAILED&limit=20', { jwtCookie: true });
  assert(
    failedList?.withdrawals?.some((item) => item.id === failedWithdrawal.id),
    'Failed withdrawal list did not include the failed withdrawal.',
  );
  await validateLedger(completedWithdrawal, failedWithdrawal);

  step('Withdrawals smoke completed');
  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        apiUrl: API_URL,
        merchant: {
          id: state.merchantId,
          email: state.merchantEmail,
          password: state.merchantPassword,
          document: state.merchantDocument,
        },
        storeId: state.storeId,
        accountId: state.accountId,
        bankAccountId: state.bankAccountId,
        apiKey: {
          prefix: state.apiKeyPrefix,
          plainKey: state.apiKeyPlainKey,
        },
        fundingPayment: {
          id: state.fundingPaymentId,
          amount: funded.payment.amount,
          netAmount: funded.payment.netAmount,
        },
        withdrawals: {
          completed: completedWithdrawal,
          failed: failedWithdrawal,
        },
        balances: {
          initialAvailable,
          finalAvailable: initialAvailable - FIRST_WITHDRAWAL_AMOUNT,
          finalBlocked: 0,
        },
        dashboardLinks: {
          withdrawals: `${DASHBOARD_URL}/dashboard/withdrawals`,
          completedWithdrawal: `${DASHBOARD_URL}/dashboard/withdrawals/${completedWithdrawal.id}`,
          failedWithdrawal: `${DASHBOARD_URL}/dashboard/withdrawals/${failedWithdrawal.id}`,
          financials: `${DASHBOARD_URL}/dashboard/financials`,
        },
      },
      null,
      2,
    ),
  );
}

try {
  await run();
} catch (error) {
  console.error(`[smoke:withdrawals] FAILED: ${formatError(error)}`);
  if (error instanceof SmokeError && error.details) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exitCode = 1;
}
