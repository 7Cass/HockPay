/**
 * A costura.
 *
 * Este é o único arquivo de `admin/` que aponta para fora da pasta, e ele existe
 * para que essa dependência seja um lugar em vez de trinta linhas de `import`
 * espalhadas pelos serviços.
 *
 * O que passa por aqui é de dois tipos, e nenhum é do lojista:
 *
 * - `ApiClientService` e `toHttpParams` são encanamento HTTP. Não sabem de
 *   lojista nem de operador; sabem de `baseUrl` e de query string.
 * - Os `type` são DTOs da API. Um pagamento tem uma forma só, e ela é definida
 *   pelo backend — redeclarar essa forma aqui não desacoplaria nada, só criaria
 *   uma segunda cópia livre para divergir em silêncio do contrato de verdade.
 *
 * O que deliberadamente NÃO passa por aqui: `shared/ui`, `styles/primitives.css`
 * e qualquer serviço com estado do lojista (`StoreService`, `AuthService`). Esses
 * o admin tem os seus, em `admin/ui` e `admin/services`.
 *
 * Quando o admin virar `apps/admin`, é este arquivo que quebra — e só ele. O
 * conserto é apontá-lo para um pacote compartilhado (`packages/api-contracts`,
 * provavelmente) em vez de para `../../core`.
 */
export { ApiClientService } from '../../core/services/api-client.service';
export { toHttpParams } from '../../core/http/list-query';
export { createIdempotencyKey } from '../../core/http/idempotency-key';
export { centsToReaisText, parseReaisToCents } from '../../core/money/reais';

export type {
  GetPaymentTimelineResponseDto,
  PaymentObject,
  RefundObject,
} from '../../core/services/payment.service';
// Valor, e não só tipo: é um enum, e comparar status pede os membros.
export { PaymentStatus } from '../../core/services/payment.service';
export type { WebhookConfig, WebhookLog } from '../../core/services/webhook.service';
export type { TransactionObject } from '../../core/models/transaction';
export type { BankAccount } from '../../core/services/bank-account.service';
export type { Withdrawal } from '../../core/services/withdrawal.service';
