import { HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { ApiClientService, createIdempotencyKey } from '../domain/api-contracts';
import type { BankAccount, PaymentObject, RefundObject, Withdrawal } from '../domain/api-contracts';
import type { Account, OperatorEnvironment } from './operator-investigation.service';

export interface OperatorWithdrawalInput {
  bankAccountId: string;
  /** Centavos. */
  amount: number;
  environment: OperatorEnvironment;
  reason: string;
}

export interface OperatorRefundInput {
  paymentId: string;
  /** Centavos. */
  amount: number;
  /** Conferência, não instrução: a API recusa se divergir do pagamento. */
  environment: OperatorEnvironment;
  reason: string;
}

export interface OperatorWithdrawalResult {
  withdrawal: Withdrawal;
  account: Account;
}

export interface OperatorRefundResult {
  refund: RefundObject;
  payment: PaymentObject;
}

/**
 * A mesa movendo dinheiro por uma loja.
 *
 * Mora separado das leituras pelo mesmo motivo que o backend separou o
 * controller: tudo aqui escreve no ledger, e isso custa uma chave de
 * idempotência e uma linha na trilha que decidir sobre a loja não custa.
 *
 * **A chave é da intenção, e não do clique nem do painel.** Ela fica presa à
 * impressão digital do pedido — rota e corpo inteiro. Mesmo pedido reenviado
 * leva a mesma chave, inclusive depois de fechar e reabrir o painel, e é isso
 * que faz a resposta perdida virar replay em vez de segundo saque. Pedido
 * diferente leva chave nova, porque a API recusa chave repetida com corpo
 * diferente, e corrigir um valor digitado errado não pode dar erro. Sucesso
 * descarta: dois saques iguais de propósito são dois saques.
 *
 * O mapa vive no serviço, que é da aplicação inteira: sobrevive a navegar para
 * outra loja e voltar. Não sobrevive a recarregar a página — e aí o que protege
 * é o saldo da confirmação seguinte, que já mostra o bloqueio do primeiro.
 */
@Injectable({
  providedIn: 'root',
})
export class OperatorMoneyService {
  private readonly api = inject(ApiClientService);
  private readonly intents = new Map<string, string>();

  /** Os destinos Pix da loja. Sem ambiente: destino é da loja, não do ledger. */
  listBankAccounts(storeId: string): Observable<BankAccount[]> {
    return this.api
      .get<{ bankAccounts: BankAccount[] }>(`/operator/stores/${storeId}/bank-accounts`)
      .pipe(map((response) => response.bankAccounts));
  }

  withdraw(storeId: string, input: OperatorWithdrawalInput): Observable<OperatorWithdrawalResult> {
    return this.send<OperatorWithdrawalResult>(`/operator/stores/${storeId}/withdrawals`, {
      bankAccountId: input.bankAccountId,
      amount: input.amount,
      environment: input.environment,
      reason: input.reason.trim(),
    });
  }

  refund(storeId: string, input: OperatorRefundInput): Observable<OperatorRefundResult> {
    return this.send<OperatorRefundResult>(`/operator/stores/${storeId}/refunds`, {
      paymentId: input.paymentId,
      amount: input.amount,
      environment: input.environment,
      reason: input.reason.trim(),
    });
  }

  /*
   * O corpo é montado acima sempre na mesma ordem de campos, então o JSON dele
   * é uma impressão digital estável sem precisar ordenar chave nenhuma.
   */
  private send<T>(path: string, body: Record<string, unknown>): Observable<T> {
    const fingerprint = JSON.stringify([path, body]);
    const key = this.intents.get(fingerprint) ?? createIdempotencyKey('operator');
    this.intents.set(fingerprint, key);

    return this.api
      .post<T>(path, body, { headers: new HttpHeaders({ 'Idempotency-Key': key }) })
      .pipe(tap(() => this.intents.delete(fingerprint)));
  }
}
