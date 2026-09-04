import {
  EVENT_CATALOG,
  EventDefinition,
  PublicEventType,
} from '../../domain/constants/event-catalog';
import { EVENT_EXAMPLES } from './event-catalog-examples';
import { buildWebhookEventPayload } from './webhook-payload-builder.service';

const GENERATED_AT_ID = 'evt_1f6b0d92';
const GENERATED_AT = new Date('2026-05-15T12:00:00.000Z');

function renderExample(eventType: PublicEventType, definition: EventDefinition): string {
  const data = EVENT_EXAMPLES[eventType];

  // Eventos manuais nao passam pelo envelope; mostrar um seria documentar algo
  // que o endpoint do lojista nunca vai receber.
  const body =
    definition.delivery === 'manual'
      ? data
      : buildWebhookEventPayload(
          GENERATED_AT_ID,
          eventType,
          definition.version,
          GENERATED_AT,
          data,
        );

  return JSON.stringify(body, null, 2);
}

function renderEntry(eventType: PublicEventType): string {
  const definition = EVENT_CATALOG[eventType];
  return [
    `### \`${eventType}\``,
    '',
    `**v${definition.version}** · agregado \`${definition.aggregateType}\``,
    '',
    definition.summary,
    '',
    `_Quando:_ ${definition.emittedWhen}`,
    '',
    '```json',
    renderExample(eventType, definition),
    '```',
    '',
  ].join('\n');
}

/**
 * Gera `docs/EVENTS.md` a partir do catalogo.
 *
 * O doc e artefato, nao fonte: quem edita e `EVENT_CATALOG` mais
 * `EVENT_EXAMPLES`, e `pnpm docs:events` reescreve o arquivo. Um teste compara
 * as duas coisas, entao editar o Markdown na mao derruba a CI em vez de criar
 * uma segunda versao da verdade.
 */
export function renderEventCatalogMarkdown(): string {
  const types = Object.keys(EVENT_CATALOG) as PublicEventType[];
  const subscribable = types.filter((type) => EVENT_CATALOG[type].delivery === 'subscribable');
  const manual = types.filter((type) => EVENT_CATALOG[type].delivery === 'manual');

  const byAggregate = new Map<string, PublicEventType[]>();
  for (const type of subscribable) {
    const aggregate = EVENT_CATALOG[type].aggregateType;
    byAggregate.set(aggregate, [...(byAggregate.get(aggregate) ?? []), type]);
  }

  const lines: string[] = [
    '# Catalogo de eventos',
    '',
    '> Arquivo gerado. Nao edite a mao: mude `EVENT_CATALOG` em',
    '> `packages/core/src/domain/constants/event-catalog.ts` (ou os exemplos em',
    '> `event-catalog-examples.ts`) e rode `pnpm docs:events`.',
    '',
    'Este e o contrato externo dos webhooks do Hockpay. Todo evento assinavel nasce',
    'no outbox, e entregue pelo worker e chega no endpoint do lojista dentro do',
    'mesmo envelope.',
    '',
    '## Envelope',
    '',
    '```json',
    JSON.stringify(
      buildWebhookEventPayload(GENERATED_AT_ID, 'payment.confirmed', 1, GENERATED_AT, {
        '...': 'o objeto do agregado',
      }),
      null,
      2,
    ),
    '```',
    '',
    '| Campo | Significado |',
    '| --- | --- |',
    '| `id` | Id do evento no outbox. Estavel entre retries: use para deduplicar. |',
    '| `type` | Tipo do evento, um dos listados abaixo. |',
    '| `version` | Versao do contrato **deste tipo**, congelada quando o evento foi produzido. |',
    '| `created_at` | Quando o evento nasceu, nao quando foi entregue. |',
    '| `data` | O objeto do agregado. `storeId` sempre presente. |',
    '',
    '### Sobre `version`',
    '',
    'A versao e por tipo, nao global: `payment.confirmed` pode estar em v2 enquanto',
    '`withdrawal.created` segue em v1. Ela e gravada junto com o evento, entao uma',
    'reentrega feita meses depois — inclusive a partir da DLQ — chega com a versao',
    'sob a qual o evento nasceu, e nao com a versao que o codigo tem hoje.',
    '',
    'A versao sobe quando a forma de `data` muda de um jeito que quebra quem ja',
    'consome: campo removido, renomeado, ou com o tipo trocado. Campo novo e',
    'opcional nao sobe versao — trate `data` como aberto para extensao.',
    '',
    '## Cabecalhos',
    '',
    '| Cabecalho | Conteudo |',
    '| --- | --- |',
    '| `X-Hockpay-Signature` | HMAC do corpo com o secret do webhook. |',
    '| `X-Hockpay-Timestamp` | Timestamp usado na assinatura. |',
    '| `X-Hockpay-Webhook-Id` | Id da tentativa de entrega. |',
    '| `X-Request-ID` | Request que originou o evento, quando houver. |',
    '',
    '## Todos os eventos',
    '',
    '| Tipo | Versao | Agregado | O que aconteceu |',
    '| --- | --- | --- | --- |',
    ...subscribable.map((type) => {
      const definition = EVENT_CATALOG[type];
      return `| \`${type}\` | v${definition.version} | \`${definition.aggregateType}\` | ${definition.summary} |`;
    }),
    '',
  ];

  for (const [aggregate, types_] of byAggregate) {
    lines.push(`## ${aggregate}`, '');
    for (const type of types_) {
      lines.push(renderEntry(type));
    }
  }

  lines.push(
    '## Disparos de teste',
    '',
    'Nao sao assinaveis e nao passam pelo outbox: so acontecem quando o lojista pede',
    'um teste. Hoje eles **nao** usam o envelope acima — vao com um corpo proprio,',
    'mais simples. Entao um teste bem-sucedido prova que a URL responde e que a',
    'assinatura confere, mas nao exercita o parser do evento real.',
    '',
  );

  for (const type of manual) {
    lines.push(renderEntry(type));
  }

  return (
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}
