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

export type {
  GetPaymentTimelineResponseDto,
  PaymentObject,
  PaymentStatus,
} from '../../core/services/payment.service';
export type { WebhookConfig, WebhookLog } from '../../core/services/webhook.service';
export type { TransactionObject } from '../../core/models/transaction';
