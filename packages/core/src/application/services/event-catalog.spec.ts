import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  ALL_EVENT_TYPES,
  EVENT_CATALOG,
  PublicEventType,
  eventContractVersion,
} from '../../domain/constants/event-catalog';
import { ALLOWED_WEBHOOK_EVENTS } from '../../domain/constants/webhook-events';
import { ALLOWED_ALERT_EVENTS } from '../../domain/constants/alert-events';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { buildWebhookEventPayload } from './webhook-payload-builder.service';
import { EVENT_EXAMPLES } from './event-catalog-examples';
import { renderEventCatalogMarkdown } from './event-catalog-doc';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

describe('event catalog', () => {
  it('exposes every subscribable type as a webhook event, and nothing else', () => {
    const subscribable = ALL_EVENT_TYPES.filter(
      (type) => EVENT_CATALOG[type].delivery === 'subscribable',
    );

    expect([...ALLOWED_WEBHOOK_EVENTS]).toEqual(subscribable);
    expect([...ALLOWED_ALERT_EVENTS]).toEqual(subscribable);
  });

  it('keeps the manual test triggers out of what a merchant can subscribe to', () => {
    expect(ALLOWED_WEBHOOK_EVENTS).not.toContain('webhook.test');
    expect(ALLOWED_WEBHOOK_EVENTS).not.toContain('alert.test');
  });

  it('documents an example payload for every catalogued type', () => {
    const missing = ALL_EVENT_TYPES.filter((type) => EVENT_EXAMPLES[type] === undefined);
    expect(missing).toEqual([]);
  });

  it('covers the whole payment link lifecycle', () => {
    const lifecycle = ALL_EVENT_TYPES.filter((type) => type.startsWith('payment_link.'));
    expect(lifecycle).toEqual([
      'payment_link.created',
      'payment_link.paid',
      'payment_link.expired',
      'payment_link.cancelled',
    ]);
  });
});

describe('event versioning', () => {
  it('stamps the catalogued version when an event is produced', () => {
    const event = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'pay_1',
      eventType: 'payment.confirmed',
      storeId: 'sto_1',
      payload: {},
    });

    expect(event.version).toBe(EVENT_CATALOG['payment.confirmed'].version);
  });

  it('refuses to produce an event that is not in the catalog', () => {
    expect(() =>
      OutboxEvent.create({
        aggregateType: 'Payment',
        aggregateId: 'pay_1',
        eventType: 'payment.vanished',
        storeId: 'sto_1',
        payload: {},
      }),
    ).toThrow(/Unknown event type/);
  });

  it('falls back to v1 for a type it no longer knows, so a DLQ replay still ships', () => {
    // Um evento gravado antes do catalogo existir precisa continuar entregavel.
    expect(eventContractVersion('payment.some_retired_type')).toBe(1);
  });

  it('carries the version in the delivered envelope', () => {
    const envelope = buildWebhookEventPayload(
      'evt_1',
      'payment.confirmed',
      2,
      new Date('2026-05-15T12:00:00.000Z'),
      { id: 'pay_1' },
    );

    expect(envelope).toEqual({
      id: 'evt_1',
      type: 'payment.confirmed',
      version: 2,
      created_at: '2026-05-15T12:00:00.000Z',
      data: { id: 'pay_1' },
    });
  });
});

describe('docs/EVENTS.md', () => {
  it('matches the catalog', () => {
    const onDisk = readFileSync(resolve(repoRoot, 'docs/EVENTS.md'), 'utf8');

    // Se isto falhar, o catalogo mudou e o doc nao: rode `pnpm docs:events`.
    expect(onDisk).toBe(renderEventCatalogMarkdown());
  });

  it('names every catalogued type', () => {
    const onDisk = readFileSync(resolve(repoRoot, 'docs/EVENTS.md'), 'utf8');
    const undocumented = (Object.keys(EVENT_CATALOG) as PublicEventType[]).filter(
      (type) => !onDisk.includes(`\`${type}\``),
    );

    expect(undocumented).toEqual([]);
  });
});
