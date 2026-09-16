import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import {
  addressLine,
  customerName,
  customerPaymentsResource,
  customerReceiptsResource,
  customerResource,
  locationLine,
} from '../../data/customers';
import { toApiFailure } from '../../domain/api-error';
import {
  MerButton,
  MerChip,
  MerCopy,
  MerPageHeader,
  MerPageState,
  MerPanel,
  MerStat,
  MerTable,
} from '../../ui';

/**
 * O cliente: quem é, e o que já moveu.
 *
 * A pergunta que traz alguém aqui é quase sempre a mesma — "esta pessoa já
 * comprou?" —, então o que ocupa a tela são as duas listas dela. O cadastro
 * fica ao lado, e não em cima.
 *
 * Nada aqui é editável. `PATCH /customers/:externalId` existe na API e nunca
 * teve tela; abrir edição de cadastro é decisão de produto, não acabamento de
 * migração — e está registrado como achado em aberto no `GOAL.md`.
 */
@Component({
  selector: 'app-console-customer-detail',
  standalone: true,
  imports: [MerButton, MerChip, MerCopy, MerPageHeader, MerPageState, MerPanel, MerStat, MerTable],
  templateUrl: './customer-detail.html',
  styleUrl: './customer-detail.css',
})
export class ConsoleCustomerDetail {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly id = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  protected readonly detail = customerResource(this.id);
  protected readonly payments = customerPaymentsResource(this.id);
  protected readonly receipts = customerReceiptsResource(this.id);

  protected readonly customer = computed(() => this.detail.value().customer);
  protected readonly name = computed(() => customerName(this.customer()));
  protected readonly address = computed(() => addressLine(this.customer()));
  protected readonly location = computed(() => locationLine(this.customer()));

  protected readonly failure = computed(() => {
    const error = this.detail.error();
    return error ? toApiFailure(error) : null;
  });

  protected readonly metadata = computed(() =>
    Object.entries(this.customer().metadata ?? {}).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    })),
  );

  /** O que este cliente já pagou, no que veio nas dez últimas cobranças. */
  protected readonly paid = computed(() =>
    this.payments
      .value()
      .payments.filter((payment) => payment.status === 'CONFIRMED' || payment.status === 'RELEASED')
      .reduce((total, payment) => total + payment.amount, 0),
  );

  protected reload(): void {
    this.detail.reload();
    this.payments.reload();
    this.receipts.reload();
  }

  protected openPayment(id: string): void {
    void this.router.navigate(['/dashboard/payments', id]);
  }

  protected openReceipt(id: string): void {
    void this.router.navigate(['/dashboard/receipts', id]);
  }

  protected money(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /*
   * `string | Date` não é folga: a costura entrega as duas formas. `PaymentObject`
   * vem do serviço antigo com `createdAt: Date`, e os tipos que a camada de dados
   * do console declara usam `string`, que é o que o JSON traz. Quem escolhe é
   * quem chama, e o `new Date` aceita os dois.
   */
  protected when(value?: string | Date): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected day(value?: string | Date): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
