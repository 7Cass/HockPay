import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { PaymentLinkListItem, PaymentLinkStatus } from '../../domain/entities/payment-link.entity';
import { LineItemObject, sanitizeLineItem } from '../../domain/entities/line-item.entity';
import { IOutboxWriter } from '../../domain/repositories/outbox-writer.repository.interface';
import { IPaymentLinkRepository } from '../../domain/repositories/payment-link.repository.interface';
import { Environment } from '../../domain/value-objects/environment.vo';

/**
 * Forma de `data` nos eventos `payment_link.*`.
 *
 * Deliberadamente **nao** carrega:
 *
 * - `pixCharge`, porque o QR vai em base64 e engorda cada entrega e cada retry
 *   por algo que o lojista busca em `GET /payment-links/:id` quando precisa;
 * - `publicToken` solto, que ja esta dentro de `checkout_url`;
 * - `attempts`, que e uma lista sem teto — o link pode ter dezenas de
 *   tentativas falhas e o webhook nao e o lugar de pagina-las.
 *
 * `storeId` nao aparece aqui porque `OutboxEvent.create` o injeta no payload.
 */
export interface PaymentLinkEventData {
  id: string;
  status: PaymentLinkStatus;
  amount: number;
  currency: string;
  environment: Environment;
  title: string | null;
  description: string | null;
  internal_reference: string | null;
  checkout_url: string;
  pix_charge_id: string;
  items: LineItemObject[];
  /** Tentativa que fechou o link, quando ha uma. */
  payment_id: string | null;
  failed_payment_count: number;
  expires_at: Date | null;
  opened_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function toPaymentLinkEventData(item: PaymentLinkListItem): PaymentLinkEventData {
  return {
    id: item.id,
    status: item.status,
    amount: item.amount,
    currency: item.currency,
    environment: item.environment,
    title: item.title,
    description: item.description,
    internal_reference: item.internalReference,
    checkout_url: item.checkoutUrl,
    pix_charge_id: item.pixChargeId,
    items: item.items.map(sanitizeLineItem),
    payment_id: item.paymentId ?? item.lastPaymentId,
    failed_payment_count: item.failedPaymentCount,
    expires_at: item.expiresAt,
    opened_at: item.openedAt,
    cancelled_at: item.cancelledAt,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export type PaymentLinkEventType =
  | 'payment_link.created'
  | 'payment_link.paid'
  | 'payment_link.expired'
  | 'payment_link.cancelled';

export function buildPaymentLinkOutboxEvent(input: {
  eventType: PaymentLinkEventType;
  link: PaymentLinkListItem;
  requestId?: string;
}): OutboxEvent {
  return OutboxEvent.create({
    aggregateType: 'PaymentLink',
    aggregateId: input.link.id,
    eventType: input.eventType,
    requestId: input.requestId,
    storeId: input.link.storeId,
    payload: toPaymentLinkEventData(input.link) as unknown as Record<string, unknown>,
  });
}

/**
 * Emite um evento de ciclo de vida do link a partir do id.
 *
 * Existe porque tres dos quatro pontos de emissao (`paid`, `expired`,
 * `cancelled`) estao em fluxos que giram em torno do Payment ou da PixCharge e
 * nao tem o link carregado na forma que o payload precisa. Reler o list item
 * dentro da mesma transacao tambem garante que o `status` publicado seja o
 * status depois da mutacao, e nao o de antes.
 *
 * Silenciosamente nao faz nada se o link sumiu: um evento a menos e melhor do
 * que derrubar uma liquidacao ja commitada por causa da notificacao.
 */
export async function emitPaymentLinkEvent(
  repos: { paymentLinkRepository: IPaymentLinkRepository; outboxWriter: IOutboxWriter },
  input: {
    eventType: PaymentLinkEventType;
    paymentLinkId: string;
    storeId: string;
    requestId?: string;
  },
): Promise<void> {
  const link = await repos.paymentLinkRepository.findListItemByIdAndStoreId(
    input.paymentLinkId,
    input.storeId,
  );
  if (!link) return;

  await repos.outboxWriter.save(
    buildPaymentLinkOutboxEvent({
      eventType: input.eventType,
      link,
      requestId: input.requestId,
    }),
  );
}

/**
 * Le o id do link a partir da metadata da tentativa.
 *
 * Um Payment nascido de link carrega `{ origin: 'payment_link', paymentLinkId }`
 * na metadata; e assim que os fluxos de pagamento sabem que ha um link por tras
 * sem ter que consultar o repositorio a cada liquidacao.
 */
export function paymentLinkIdFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata || metadata.origin !== 'payment_link') return null;
  const id = metadata.paymentLinkId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
