import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { WebhookConfig, WebhookLog } from '@hockpay/core';
import { OperatorModule } from './operator.module';

type ControllerClass = new (...args: never[]) => Record<string, unknown>;

/**
 * The values planted in everything the mocked use cases return. If any of them
 * comes back out of a route, the route is leaking.
 */
const PLANTED_WEBHOOK_SECRET = 'whsec_PLANTED_SECRET_DO_NOT_LEAK';
const PLANTED_API_KEY = 'hk_test_PLANTED_KEY_DO_NOT_LEAK';

/**
 * Keys that must never appear in an operator response, at any depth. The
 * planted-value check catches a leak of *these* fixtures; the key check
 * catches a leak of some other record's credential that the fixtures never
 * planted.
 */
const FORBIDDEN_KEYS = [
  'secret',
  'hashedkey',
  'hashedsecret',
  'plainkey',
  'plainsecret',
  'passwordhash',
];

function operatorControllers(): ControllerClass[] {
  return (Reflect.getMetadata('controllers', OperatorModule) ??
    []) as ControllerClass[];
}

/**
 * Every GET handler registered on the operator surface, found by reflection.
 *
 * This is the point of the whole file: a hand-written list of routes starts
 * lying with the first route somebody adds. A new route shows up here on its
 * own, and a new route that leaks breaks the build instead of the review.
 */
function operatorReadHandlers(): Array<[string, ControllerClass, string]> {
  const handlers: Array<[string, ControllerClass, string]> = [];

  for (const controller of operatorControllers()) {
    const prototype = controller.prototype as Record<string, unknown>;

    for (const key of Object.getOwnPropertyNames(prototype)) {
      if (key === 'constructor') continue;

      const handler = prototype[key];
      if (typeof handler !== 'function') continue;

      const method = Reflect.getMetadata(METHOD_METADATA, handler);
      if (method !== RequestMethod.GET) continue;

      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      handlers.push([
        `${controller.name}.${key} (GET ${path})`,
        controller,
        key,
      ]);
    }
  }

  return handlers;
}

function webhookConfigWithSecret(): WebhookConfig {
  return WebhookConfig.reconstitute({
    id: 'webhook-1',
    storeId: 'store-1',
    url: 'https://example.test/hook',
    secret: PLANTED_WEBHOOK_SECRET,
    prefix: 'whsec_PLANT',
    events: ['payment.confirmed'],
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function webhookLogWithSignature(): WebhookLog {
  return WebhookLog.reconstitute({
    id: 'log-1',
    configId: 'webhook-1',
    eventType: 'payment.confirmed',
    payload: { id: 'evt-1' },
    // The HMAC signature is a request header. It is not the secret and does
    // not let anyone derive it, so it stays -- but the planted secret itself
    // must never ride along beside it.
    requestHeaders: { 'x-hockpay-signature': 'sha256=deadbeef' },
    status: 'delivered' as never,
    attempt: 1,
    maxAttempts: 5,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  } as never);
}

/**
 * Every operator use case, mocked to return a payload carrying the planted
 * credentials wherever the real one could carry them.
 */
function plantedUseCases(): Record<
  string,
  { execute: () => Promise<unknown> }
> {
  const store = {
    id: 'store-1',
    merchantId: 'merchant-1',
    name: 'Ateliê Corvo',
    slug: 'atelie-corvo',
    isActive: true,
    liveStatus: 'APPROVED',
    settlementDays: 30,
    feePercent: 1.5,
    feeFixed: 15,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const configs = [webhookConfigWithSecret()];
  const logs = [webhookLogWithSignature()];

  return {
    getOperatorUseCase: { execute: async () => ({ id: 'operator-1' }) },
    listOperatorAuditLogsUseCase: {
      execute: async () => ({ logs: [], total: 0, limit: 20, offset: 0 }),
    },
    listStoresForOperatorUseCase: {
      execute: async () => ({
        stores: [store],
        total: 1,
        limit: 20,
        offset: 0,
      }),
    },
    decideLiveEnablementUseCase: { execute: async () => ({ store }) },
    updateCommercialTermsUseCase: { execute: async () => ({ store }) },
    getStoreForOperatorUseCase: { execute: async () => ({ store }) },
    listPaymentsUseCase: {
      execute: async () => ({
        // A payment carries no credential, but the API key that created it is
        // the kind of thing a future "enriched" response might reach for.
        payments: [{ id: 'pay-1', apiKeyId: 'key-1', amount: 1000 }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    },
    getPaymentTimelineUseCase: {
      execute: async () => ({
        payment: { id: 'pay-1' },
        relatedAttempts: [],
        refunds: [],
        transactions: [],
        webhookLogs: logs.map((log) => log.toObject()),
        timeline: [],
      }),
    },
    getAccountUseCase: {
      execute: async () => ({
        account: { id: 'acc-1', availableBalance: 100, pendingBalance: 0 },
      }),
    },
    listTransactionsUseCase: {
      execute: async () => ({
        data: [{ id: 'tx-1', amount: 100 }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    },
    listBankAccountsUseCase: {
      // A Pix destination is where money goes, not a credential: the key and
      // the holder document are what the desk needs to choose one. What must
      // not ride along is anything the store authenticates with.
      execute: async () => [
        {
          bankAccount: {
            id: 'bank-1',
            storeId: 'store-1',
            pixKey: 'financeiro@atelie.example',
            pixKeyType: 'EMAIL',
            holderName: 'Ateliê Corvo',
            holderDocument: '12345678000190',
            isDefault: true,
            isVerified: true,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          hasWithdrawals: false,
          hasActiveWithdrawals: false,
          withdrawalCount: 0,
          activeWithdrawalCount: 0,
        },
      ],
    },
    listWebhookConfigsUseCase: {
      execute: async () => ({
        webhookConfigs: configs,
        circuits: { 'webhook-1': { state: 'closed' } },
      }),
    },
    listWebhookLogsUseCase: {
      execute: async () => ({ logs, total: 1, page: 1, limit: 50 }),
    },
  };
}

/**
 * Build a controller with every constructor slot filled by a mocked use case,
 * matched by the parameter name the controller declares.
 */
function instantiate(controller: ControllerClass): Record<string, unknown> {
  const mocks = plantedUseCases();
  const source = controller.toString();
  const ctorArgs = source
    .slice(
      source.indexOf('constructor('),
      source.indexOf(') {', source.indexOf('constructor(')),
    )
    .replace('constructor(', '')
    .split(',')
    .map((part) =>
      part.trim().replace(/^(private|readonly|public|protected)\s+/g, ''),
    )
    .map((part) =>
      part
        .replace(/readonly\s+/g, '')
        .split(':')[0]
        .trim(),
    )
    .filter(Boolean);

  const deps = ctorArgs.map(
    (name) => mocks[name] ?? { execute: async () => ({}) },
  );

  return new (controller as unknown as new (
    ...args: unknown[]
  ) => Record<string, unknown>)(...deps);
}

/**
 * Walk anything -- entities, plain objects, arrays -- and report every place a
 * forbidden key or a planted value shows up.
 */
function findLeaks(
  value: unknown,
  path = '$',
  seen = new Set<unknown>(),
): string[] {
  if (value === null || value === undefined) return [];

  if (typeof value === 'string') {
    if (value.includes(PLANTED_WEBHOOK_SECRET))
      return [`${path} carries the webhook secret`];
    if (value.includes(PLANTED_API_KEY)) return [`${path} carries the API key`];
    return [];
  }

  if (typeof value !== 'object') return [];
  if (value instanceof Date) return [];
  if (seen.has(value)) return [];
  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findLeaks(item, `${path}[${index}]`, seen),
    );
  }

  const leaks: string[] = [];

  // Entities serialize before they reach the wire, so follow the same door the
  // controller would: whatever `toObject()` returns is what could go out.
  const serializer = (value as { toObject?: unknown }).toObject;
  if (typeof serializer === 'function') {
    leaks.push(
      ...findLeaks(
        (serializer as () => unknown).call(value),
        `${path}.toObject()`,
        seen,
      ),
    );
  }

  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase().replace(/^_/, ''))) {
      leaks.push(`${path}.${key} is a forbidden key`);
    }
    leaks.push(...findLeaks(nested, `${path}.${key}`, seen));
  }

  return leaks;
}

/**
 * The failure mode this guards against: a read route added to the operator
 * surface that hands back a webhook secret or an API key. Checked here instead
 * of in review, because review does not run on the route somebody adds next
 * year.
 */
describe('operator reads never return a credential', () => {
  it('finds GET routes to sweep', () => {
    expect(operatorReadHandlers().length).toBeGreaterThan(0);
  });

  it.each(operatorReadHandlers())(
    '%s returns no secret',
    async (_name, controller, key) => {
      const instance = instantiate(controller);
      const handler = instance[key] as (...args: unknown[]) => Promise<unknown>;

      // Handler parameters are ids, query DTOs, the current operator and the
      // request. The mocked use cases ignore all of them, so one permissive
      // object per slot is enough to reach the response shape.
      const args = Array.from({ length: handler.length }, () => ({
        operatorId: 'operator-1',
        environment: 'TEST',
      }));

      const response = await handler.apply(instance, args);

      expect(findLeaks(response)).toEqual([]);
    },
  );

  it('actually fails when a route hands back the secret', () => {
    // The sweep is only worth having if it can fail. This proves the detector
    // catches the exact shape a careless `toObject()` would produce.
    const leaked = { webhooks: [webhookConfigWithSecret().toObject()] };

    expect(findLeaks(leaked)).not.toEqual([]);
  });

  it('does not flag the HMAC signature header, which is not the secret', () => {
    expect(findLeaks({ logs: [webhookLogWithSignature().toObject()] })).toEqual(
      [],
    );
  });

  it('has no route for API keys at all', () => {
    // Not filtered -- absent. The parent PRD says support investigates
    // deliveries and logs, not credentials.
    const paths = operatorReadHandlers().map(([name]) => name.toLowerCase());

    expect(
      paths.some((path) => path.includes('api-key') || path.includes('apikey')),
    ).toBe(false);
  });
});
