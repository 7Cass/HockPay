import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { receiptResource } from '../../data/receipts';
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
 * O comprovante, como documento.
 *
 * É a única tela do console que mostra a **decomposição do valor** para o
 * pagador: bruto, taxa e líquido lado a lado. O lojista chega aqui quando
 * alguém pede "o recibo", e o que ele precisa é de algo que se copie e se
 * mande — daí o número em destaque e o id do pagamento copiável.
 */
@Component({
  selector: 'app-console-receipt-detail',
  standalone: true,
  imports: [MerButton, MerChip, MerCopy, MerPageHeader, MerPageState, MerPanel, MerStat, MerTable],
  templateUrl: './receipt-detail.html',
  styleUrl: './receipt-detail.css',
})
export class ConsoleReceiptDetail {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** O id vem da URL e o recurso refaz sozinho quando ele muda. */
  protected readonly id = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  protected readonly detail = receiptResource(this.id);
  protected readonly receipt = computed(() => this.detail.value().receipt);

  protected readonly failure = computed(() => {
    const error = this.detail.error();
    return error ? toApiFailure(error) : null;
  });

  protected readonly items = computed(() => this.receipt().items ?? []);

  protected openPayment(): void {
    const paymentId = this.receipt().paymentId;
    if (paymentId) void this.router.navigate(['/dashboard/payments', paymentId]);
  }

  protected money(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  protected when(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected maskDocument(value?: string | null): string {
    const clean = String(value ?? '').replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
    }
    if (clean.length === 14) {
      return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
    }
    return value || '—';
  }
}
