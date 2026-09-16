/**
 * A costura.
 *
 * Este é o único arquivo de `merchant/` que aponta para fora da pasta, e ele
 * existe para que essa dependência seja um lugar em vez de trinta linhas de
 * `import` espalhadas pelas telas. O teste de fronteira (`boundary.spec.ts`)
 * falha se qualquer outro arquivo daqui importar de fora.
 *
 * É a mesma costura que `admin/domain/api-contracts.ts` — e pela mesma razão.
 * O que passa por aqui é de três tipos:
 *
 * - **encanamento HTTP** (`ApiClientService`, `toHttpParams`,
 *   `createIdempotencyKey`): não sabe de lojista nem de operador; sabe de
 *   `baseUrl`, de query string e do header que a API exige.
 * - **DTOs da API**: um pagamento tem uma forma só, e ela é definida pelo
 *   backend. Redeclarar essa forma aqui não desacoplaria nada — criaria uma
 *   segunda cópia livre para divergir em silêncio do contrato de verdade.
 * - **os serviços de sessão** (`AuthService`, `StoreService`,
 *   `EnvironmentService`), e estes são o que distingue esta costura da do
 *   admin. A mesa tem sessão própria; o lojista **é** a sessão que `core/`
 *   guarda hoje. Eles atravessam a costura de propósito e **em caráter
 *   temporário**: a fatia 7 os traz para `merchant/data/session`, e o dia em
 *   que isso acontecer estas três linhas somem daqui.
 *
 * O que deliberadamente NÃO passa: `shared/ui`, `styles/primitives.css`,
 * `libs/ui` e qualquer peça de tela de fora. Essas o console tem as suas, em
 * `merchant/ui`.
 *
 * A costura cresce por fatia. Só entra aqui o que a fatia em curso precisa —
 * uma lista de reexports que adivinha o futuro envelhece sem ninguém notar.
 */

/* ── Encanamento HTTP ─────────────────────────────────────────────────────── */
export { ApiClientService } from '../../core/services/api-client.service';
export { toHttpParams } from '../../core/http/list-query';
export { createIdempotencyKey } from '../../core/http/idempotency-key';

/* ── Dinheiro ─────────────────────────────────────────────────────────────
   O parser estrito que substituiu o que lia `10.50` como R$ 1.050,00. Ele mora
   em `core/` desde `2026-09-11`, e as duas superfícies usam o mesmo. */
export { centsToReaisText, parseReaisToCents } from '../../core/money/reais';

/* ── Sessão (temporário, sai na fatia 7) ──────────────────────────────────── */
export { AuthService } from '../../core/services/auth.service';
export { StoreService, type Store, type StoreLiveStatus } from '../../core/services/store.service';
export { EnvironmentService, type ApiEnvironment } from '../../core/services/environment.service';

/* ── DTOs da API ──────────────────────────────────────────────────────────── */
export type {
  ListPaymentsQueryDto,
  ListPaymentsResponseDto,
  PaymentLineItem,
  PaymentObject,
} from '../../core/services/payment.service';
// Valor, e não só tipo: é um enum, e comparar status pede os membros.
export { PaymentStatus } from '../../core/services/payment.service';
export type { TransactionObject, TransactionType } from '../../core/models/transaction';
