import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlertSendInput } from '@hockpay/core';
import { DiscordAlertSenderService } from './discord-alert-sender.service';

function captureSentPayload(): { read: () => Record<string, unknown> } {
  let captured: Record<string, unknown> = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      captured = JSON.parse(init.body) as Record<string, unknown>;
      return {
        status: 204,
        ok: true,
        headers: new Headers(),
        text: async () => '',
      };
    }),
  );
  return { read: () => captured };
}

function inputWith(payment: Record<string, unknown>): AlertSendInput {
  return {
    channel: 'discord',
    decryptedConfig: { discord: { webhookUrl: 'https://discord.com/api/webhooks/1/token' } },
    eventType: 'payment.confirmed',
    payload: { payment },
  };
}

function fieldValue(payload: Record<string, unknown>, name: string): string | undefined {
  const embeds = payload.embeds as { fields: { name: string; value: string }[] }[];
  return embeds[0].fields.find((f) => f.name === name)?.value;
}

describe('DiscordAlertSenderService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders primitive fields as-is', async () => {
    const sent = captureSentPayload();
    await new DiscordAlertSenderService().send(
      inputWith({ id: 'pay-1', status: 'CONFIRMED', amount: 12345 }),
    );

    const payload = sent.read();
    expect(fieldValue(payload, 'Payment ID')).toBe('pay-1');
    expect(fieldValue(payload, 'Status')).toBe('CONFIRMED');
  });

  it('never renders a non-primitive field as [object Object]', async () => {
    const sent = captureSentPayload();
    // `payload` e Record<string, unknown>: nada garante que o produtor do
    // evento mandou uma string aqui.
    await new DiscordAlertSenderService().send(
      inputWith({ id: { value: 'pay-1' }, status: 'CONFIRMED', amount: 100 }),
    );

    const rendered = fieldValue(sent.read(), 'Payment ID');
    expect(rendered).not.toContain('[object Object]');
    expect(rendered).toBe('{"value":"pay-1"}');
  });
});
