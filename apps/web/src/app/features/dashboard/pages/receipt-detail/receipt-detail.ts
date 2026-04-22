import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheckCircle2,
  lucideFileText,
  lucideReceipt,
  lucideXCircle,
} from '@ng-icons/lucide';
import { ReceiptService, ReceiptStatus } from '../../../../core/services/receipt.service';

@Component({
  selector: 'app-receipt-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    CurrencyPipe,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSpinnerImports,
    HlmIconImports,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideCheckCircle2,
      lucideFileText,
      lucideReceipt,
      lucideXCircle,
    }),
  ],
  template: `
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <a
            routerLink="/dashboard/receipts"
            class="mb-3 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ng-icon hlm name="lucideArrowLeft" size="sm"></ng-icon>
            Voltar para comprovantes
          </a>
          <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Detalhes do comprovante</h1>
          <p class="mt-1 text-sm text-zinc-500">Visualize o snapshot financeiro e os dados do pagador registrados na emissão.</p>
        </div>

        @if (receiptService.currentReceipt()) {
          <div class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap" [class]="getBadgeClasses(receiptService.currentReceipt()!.status)">
            <ng-icon hlm [name]="getStatusIcon(receiptService.currentReceipt()!.status)" size="xs"></ng-icon>
            {{ formatStatus(receiptService.currentReceipt()!.status) }}
          </div>
        }
      </div>

      @if (receiptService.isDetailLoading()) {
        <div class="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-zinc-200/80 bg-white py-24 shadow-sm">
          <hlm-spinner class="h-6 w-6 animate-spin text-indigo-600" />
          <p class="mt-4 text-sm font-medium text-zinc-500">Carregando comprovante...</p>
        </div>
      }

      @if (!receiptService.isDetailLoading() && receiptService.detailError()) {
        <div class="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-red-200/60 bg-red-50 px-6 py-24 text-center shadow-sm">
          <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
            <ng-icon hlm name="lucideXCircle" class="text-red-500" size="lg"></ng-icon>
          </div>
          <h3 class="text-base font-semibold text-red-700">Não foi possível carregar o comprovante</h3>
          <p class="mt-2 max-w-md text-sm text-red-700/90">{{ receiptService.detailError() }}</p>
          <a
            routerLink="/dashboard/receipts"
            hlmBtn
            class="mt-6 bg-white text-red-700 shadow-sm hover:bg-red-100"
          >
            Voltar para a lista
          </a>
        </div>
      }

      @if (!receiptService.isDetailLoading() && receiptService.currentReceipt(); as receipt) {
        <div class="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
          <div class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            <div class="flex items-start justify-between gap-4 border-b border-zinc-200/80 pb-5">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Número do comprovante</p>
                <p class="mt-2 font-mono text-lg font-semibold text-zinc-900">{{ receipt.receiptNumber }}</p>
              </div>
              <div class="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50 text-zinc-600">
                <ng-icon hlm name="lucideReceipt" size="lg"></ng-icon>
              </div>
            </div>

            <div class="mt-6 grid gap-6 md:grid-cols-2">
              <section class="space-y-4">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pagador</p>
                  <p class="mt-2 text-sm font-semibold text-zinc-900">{{ receipt.payerName || 'Cliente não identificado' }}</p>
                  <p class="mt-1 text-sm text-zinc-500">{{ receipt.payerEmail || 'E-mail não informado' }}</p>
                  <p class="mt-1 text-sm text-zinc-500">{{ receipt.payerDocument || 'Documento não informado' }}</p>
                </div>

                <div>
                  <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Descrição</p>
                  <p class="mt-2 text-sm text-zinc-700">{{ receipt.description || 'Sem descrição registrada.' }}</p>
                </div>
              </section>

              <section class="space-y-4">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Recebedor</p>
                  <p class="mt-2 text-sm font-semibold text-zinc-900">{{ receipt.payeeName }}</p>
                  <p class="mt-1 text-sm text-zinc-500">{{ receipt.payeeDocument || 'Documento não informado' }}</p>
                </div>

                <div>
                  <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pagamento vinculado</p>
                  <p class="mt-2 font-mono text-sm text-zinc-700">{{ receipt.paymentId }}</p>
                </div>
              </section>
            </div>
          </div>

          <div class="flex flex-col gap-6">
            <div class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <ng-icon hlm name="lucideFileText" size="sm"></ng-icon>
                </div>
                <div>
                  <p class="text-sm font-semibold text-zinc-900">Resumo financeiro</p>
                  <p class="text-xs text-zinc-500">Snapshot salvo no momento da confirmação</p>
                </div>
              </div>

              <div class="mt-6 space-y-4">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-500">Valor bruto</span>
                  <span class="font-semibold text-zinc-900">{{ receipt.amount / 100 | currency:'BRL':'symbol':'1.2-2' }}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-zinc-500">Taxa</span>
                  <span class="font-semibold text-red-600">-{{ receipt.fee / 100 | currency:'BRL':'symbol':'1.2-2' }}</span>
                </div>
                <div class="flex items-center justify-between border-t border-zinc-200/80 pt-4 text-sm">
                  <span class="text-zinc-500">Valor líquido</span>
                  <span class="text-base font-semibold text-emerald-600">{{ receipt.netAmount / 100 | currency:'BRL':'symbol':'1.2-2' }}</span>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <p class="text-sm font-semibold text-zinc-900">Metadados</p>

              <dl class="mt-5 space-y-4 text-sm">
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">Emitido em</dt>
                  <dd class="text-right font-medium text-zinc-900">{{ receipt.issuedAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">Criado em</dt>
                  <dd class="text-right font-medium text-zinc-900">{{ receipt.createdAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">Atualizado em</dt>
                  <dd class="text-right font-medium text-zinc-900">{{ receipt.updatedAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">Moeda</dt>
                  <dd class="text-right font-medium text-zinc-900">{{ receipt.currency }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ReceiptDetail implements OnInit, OnDestroy {
  readonly receiptService = inject(ReceiptService);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const receiptId = this.route.snapshot.paramMap.get('id');

    if (!receiptId) {
      this.receiptService.clearDetailState();
      return;
    }

    this.receiptService.loadReceipt(receiptId);
  }

  ngOnDestroy(): void {
    this.receiptService.clearDetailState();
  }

  formatStatus(status: ReceiptStatus): string {
    return status === ReceiptStatus.CANCELLED ? 'Cancelado' : 'Emitido';
  }

  getStatusIcon(status: ReceiptStatus): string {
    return status === ReceiptStatus.CANCELLED ? 'lucideXCircle' : 'lucideCheckCircle2';
  }

  getBadgeClasses(status: ReceiptStatus): string {
    return status === ReceiptStatus.CANCELLED
      ? 'border-red-200/60 bg-red-50 text-red-700'
      : 'border-emerald-200/60 bg-emerald-50 text-emerald-700';
  }
}
