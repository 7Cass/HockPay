import {
  AlertSendInput,
  AlertSendResponse,
  IAlertSenderPort,
} from '@hockpay/core';

export class DiscordAlertSenderService implements IAlertSenderPort {
  private readonly timeout = 30000;

  async send(input: AlertSendInput): Promise<AlertSendResponse> {
    const url = new URL(input.decryptedConfig.discord.webhookUrl);
    url.searchParams.set('wait', 'true');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Hockpay-Alerts/1.0',
        },
        body: JSON.stringify(buildDiscordPayload(input)),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const body = await response.text();
      return {
        statusCode: response.status,
        body,
        success: response.ok,
        retryAfterSeconds: parseRetryAfter(response, body),
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const body = error instanceof Error ? error.message : String(error);
      return {
        statusCode: 0,
        body,
        success: false,
      };
    }
  }
}

function buildDiscordPayload(input: AlertSendInput): Record<string, unknown> {
  const payment = extractPayment(input.payload);
  const amount = typeof payment.amount === 'number' ? formatCurrency(payment.amount) : '-';
  const status = stringify(payment.status ?? '-');
  const description = input.test
    ? 'Teste de alerta operacional enviado pela Hockpay.'
    : eventDescription(input.eventType);

  const fields = [
    { name: 'Evento', value: input.eventType, inline: true },
    { name: 'Status', value: status, inline: true },
    { name: 'Valor', value: amount, inline: true },
    { name: 'Payment ID', value: stringify(payment.id ?? '-'), inline: false },
  ];
  const paymentLinkId = stringValue(payment.paymentLinkId) ?? metadataString(payment, 'paymentLinkId');
  const pixChargeId = stringValue(payment.pixChargeId) ?? nestedString(payment.pixCharge, 'id');
  const pixTxId = nestedString(payment.pixCharge, 'pixTxId');
  const attemptNumber = numberValue(payment.attemptNumber);
  const attemptCount = numberValue(payment.attemptCount);

  if (paymentLinkId) {
    fields.push({ name: 'Payment Link', value: paymentLinkId, inline: true });
  }
  if (pixChargeId) {
    fields.push({ name: 'PixCharge', value: pixChargeId, inline: true });
  }
  if (attemptNumber && attemptCount) {
    fields.push({ name: 'Tentativa', value: `#${attemptNumber} de ${attemptCount}`, inline: true });
  }
  if (pixTxId) {
    fields.push({ name: 'Pix TxID', value: pixTxId, inline: false });
  }

  if (payment.externalId) {
    fields.push({ name: 'External ID', value: stringify(payment.externalId), inline: true });
  }
  if (payment.payerName) {
    fields.push({ name: 'Pagador', value: stringify(payment.payerName), inline: true });
  }

  return {
    username: 'Hockpay Alerts',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: input.test ? 'Teste de alerta' : eventTitle(input.eventType),
        description,
        color: colorForEvent(input.eventType),
        timestamp: new Date().toISOString(),
        fields: fields.map((field) => ({
          ...field,
          name: truncate(field.name, 256),
          value: truncate(field.value, 1024),
        })),
        footer: {
          text: 'Hockpay Alerts',
        },
      },
    ],
  };
}

function extractPayment(payload: Record<string, unknown>): Record<string, unknown> {
  if (payload.payment && typeof payload.payment === 'object') {
    return payload.payment as Record<string, unknown>;
  }
  return payload;
}

function eventTitle(eventType: string): string {
  const titles: Record<string, string> = {
    'payment.created': 'Pagamento criado',
    'payment.confirmed': 'Pagamento confirmado',
    'payment.failed': 'Pagamento falhou',
    'payment.expired': 'Pagamento expirado',
    'payment.released': 'Repasse liberado',
  };
  return titles[eventType] ?? 'Alerta operacional';
}

function eventDescription(eventType: string): string {
  const descriptions: Record<string, string> = {
    'payment.created': 'Uma nova cobranca entrou no fluxo da loja.',
    'payment.confirmed': 'Uma venda foi confirmada e pode exigir acompanhamento operacional.',
    'payment.failed': 'Um pagamento falhou e pode exigir verificacao do time.',
    'payment.expired': 'Um pagamento expirou antes da confirmacao.',
    'payment.released': 'Um repasse foi liberado para acompanhamento financeiro.',
  };
  return descriptions[eventType] ?? 'Evento operacional recebido.';
}

function colorForEvent(eventType: string): number {
  const colors: Record<string, number> = {
    'payment.created': 0x6366f1,
    'payment.confirmed': 0x10b981,
    'payment.failed': 0xef4444,
    'payment.expired': 0xf59e0b,
    'payment.released': 0x0ea5e9,
  };
  return colors[eventType] ?? 0x71717a;
}

function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amountInCents / 100);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '-';
  return String(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function metadataString(payment: Record<string, unknown>, key: string): string | undefined {
  const metadata = payment.metadata;
  if (!metadata || typeof metadata !== 'object') return undefined;
  return stringValue((metadata as Record<string, unknown>)[key]);
}

function nestedString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return stringValue((value as Record<string, unknown>)[key]);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

function parseRetryAfter(response: Response, body: string): number | undefined {
  const retryAfterHeader = response.headers.get('retry-after');
  if (retryAfterHeader) {
    const retryAfter = Number(retryAfterHeader);
    if (Number.isFinite(retryAfter)) return retryAfter;
  }

  try {
    const parsed = JSON.parse(body) as { retry_after?: unknown };
    if (typeof parsed.retry_after === 'number') return parsed.retry_after;
  } catch {
    return undefined;
  }

  return undefined;
}
