import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideCheckCircle2,
  lucideReceipt,
  lucideRefreshCcw,
  lucideSearch,
  lucideXCircle,
} from '@ng-icons/lucide';
import { ReceiptService, ReceiptStatus } from '../../../../core/services/receipt.service';

@Component({
  selector: 'app-receipts',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    CurrencyPipe,
    HlmTableImports,
    HlmBadgeImports,
    HlmSpinnerImports,
    HlmButtonImports,
    HlmIconImports,
    HlmInputImports,
  ],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideCheckCircle2,
      lucideReceipt,
      lucideRefreshCcw,
      lucideSearch,
      lucideXCircle,
    }),
  ],
  template: `
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Comprovantes</h1>
          <p class="mt-1 text-sm text-zinc-500">Consulte os comprovantes emitidos para pagamentos confirmados da sua loja.</p>
        </div>

        <button
          hlmBtn
          variant="outline"
          size="sm"
          class="gap-2 self-start border-zinc-200/80 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
          (click)="reload()"
        >
          <ng-icon hlm name="lucideRefreshCcw" size="xs"></ng-icon>
          Atualizar
        </button>
      </div>

      <div class="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div class="flex-1">
            <label for="receipt-search" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Buscar por número
            </label>
            <div class="relative">
              <ng-icon hlm name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size="sm"></ng-icon>
              <input
                hlmInput
                id="receipt-search"
                type="text"
                [value]="receiptNumber()"
                (input)="onReceiptNumberInput($any($event.target).value)"
                (keydown.enter)="applySearch()"
                class="pl-10"
                placeholder="RCP-20260419-00001"
              />
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              hlmBtn
              variant="outline"
              size="sm"
              class="border-zinc-200/80 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
              (click)="clearSearch()"
            >
              Limpar
            </button>
            <button
              hlmBtn
              size="sm"
              class="gap-2 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
              (click)="applySearch()"
            >
              <ng-icon hlm name="lucideSearch" size="xs"></ng-icon>
              Buscar
            </button>
          </div>
        </div>
      </div>

      @if (receiptService.error()) {
        <div class="flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50 p-4 text-red-700 shadow-sm">
          <ng-icon hlm name="lucideXCircle" class="mt-0.5 text-red-500"></ng-icon>
          <div class="flex-1">
            <h3 class="text-sm font-semibold">Erro ao carregar comprovantes</h3>
            <p class="mt-1 text-sm opacity-90">{{ receiptService.error() }}</p>
          </div>
        </div>
      }

      <div class="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm">
        @if (receiptService.isLoading()) {
          <div class="flex flex-1 flex-col items-center justify-center py-24">
            <hlm-spinner class="h-6 w-6 animate-spin text-indigo-600" />
            <p class="mt-4 text-sm font-medium text-zinc-500">Buscando comprovantes...</p>
          </div>
        }

        @if (!receiptService.isLoading() && !receiptService.error() && receiptService.receipts().length === 0) {
          <div class="flex flex-1 flex-col items-center justify-center bg-zinc-50/30 px-6 py-24 text-center">
            <div class="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 shadow-sm">
              <ng-icon hlm name="lucideReceipt" size="xl" class="text-indigo-600 opacity-80" strokeWidth="1.5"></ng-icon>
            </div>
            <h3 class="mb-1.5 text-base font-semibold text-zinc-900">Nenhum comprovante encontrado</h3>
            <p class="mx-auto max-w-sm text-sm text-zinc-500">
              {{ hasActiveSearch() ? 'Nenhum comprovante corresponde ao número informado.' : 'Os comprovantes aparecerão aqui depois que os pagamentos forem confirmados.' }}
            </p>
          </div>
        }

        @if (!receiptService.isLoading() && receiptService.receipts().length > 0) {
          <div class="flex-1 overflow-x-auto">
            <table hlmTable class="w-full">
              <thead hlmTHead class="border-b border-zinc-200/80 bg-zinc-50/50">
                <tr hlmTr class="border-none hover:bg-transparent">
                  <th hlmTh class="py-3.5 pl-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">Número</th>
                  <th hlmTh class="py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Pagador</th>
                  <th hlmTh class="py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Valor</th>
                  <th hlmTh class="py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                  <th hlmTh class="py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Emitido em</th>
                  <th hlmTh class="py-3.5 pr-6 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Ação</th>
                </tr>
              </thead>

              <tbody hlmTBody class="divide-y divide-zinc-100">
                @for (receipt of receiptService.receipts(); track receipt.id) {
                  <tr hlmTr class="group border-none transition-colors hover:bg-zinc-50/80">
                    <td hlmTd class="py-3.5 pl-6">
                      <div class="flex flex-col">
                        <span class="font-mono text-sm font-semibold text-zinc-900">{{ receipt.receiptNumber }}</span>
                        <span class="mt-0.5 text-xs text-zinc-400">{{ receipt.paymentId.slice(0, 8) }}...</span>
                      </div>
                    </td>
                    <td hlmTd class="py-3.5">
                      <div class="flex flex-col">
                        <span class="text-sm font-medium text-zinc-900">{{ receipt.payerName || 'Cliente não identificado' }}</span>
                        <span class="mt-0.5 text-xs text-zinc-400">{{ receipt.payerEmail || receipt.payerDocument || 'Sem dado adicional' }}</span>
                      </div>
                    </td>
                    <td hlmTd class="py-3.5 text-right">
                      <span class="text-sm font-semibold text-emerald-600">{{ receipt.amount / 100 | currency:'BRL':'symbol':'1.2-2' }}</span>
                    </td>
                    <td hlmTd class="px-4 py-3.5 text-center">
                      <div class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap" [class]="getBadgeClasses(receipt.status)">
                        <ng-icon hlm [name]="getStatusIcon(receipt.status)" size="xs"></ng-icon>
                        {{ formatStatus(receipt.status) }}
                      </div>
                    </td>
                    <td hlmTd class="py-3.5">
                      <div class="flex flex-col">
                        <span class="text-sm font-medium text-zinc-900">{{ receipt.issuedAt | date:'dd/MM/yyyy' }}</span>
                        <span class="mt-0.5 text-xs text-zinc-400">{{ receipt.issuedAt | date:'HH:mm' }}</span>
                      </div>
                    </td>
                    <td hlmTd class="py-3.5 pr-6 text-right">
                      <button
                        hlmBtn
                        variant="ghost"
                        size="sm"
                        class="gap-2 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                        (click)="openReceipt(receipt.id)"
                      >
                        Ver detalhes
                        <ng-icon hlm name="lucideArrowRight" size="xs"></ng-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="flex flex-col gap-3 border-t border-zinc-200/80 bg-zinc-50/50 px-6 py-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span class="flex items-center gap-1.5">
              Exibindo
              <span class="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-semibold text-zinc-700 shadow-sm">
                {{ receiptService.receipts().length }}
              </span>
              de
              <span class="font-semibold text-zinc-900">{{ receiptService.total() }}</span>
              comprovantes
            </span>

            <div class="flex items-center gap-3 self-end sm:self-auto">
              <button
                hlmBtn
                variant="outline"
                size="sm"
                class="border-zinc-200/80 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
                [disabled]="receiptService.page() <= 1"
                (click)="changePage(-1)"
              >
                Anterior
              </button>
              <span>Página <span class="font-semibold text-zinc-900">{{ receiptService.page() }}</span> de <span class="font-semibold text-zinc-900">{{ receiptService.totalPages() || 1 }}</span></span>
              <button
                hlmBtn
                variant="outline"
                size="sm"
                class="border-zinc-200/80 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
                [disabled]="receiptService.page() >= receiptService.totalPages()"
                (click)="changePage(1)"
              >
                Próxima
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class Receipts implements OnInit {
  readonly receiptService = inject(ReceiptService);
  private readonly router = inject(Router);

  readonly receiptNumber = signal('');
  private readonly pageSize = 20;

  ngOnInit(): void {
    this.loadReceipts();
  }

  onReceiptNumberInput(value: string): void {
    this.receiptNumber.set(value);
  }

  applySearch(): void {
    this.loadReceipts(1);
  }

  clearSearch(): void {
    this.receiptNumber.set('');
    this.loadReceipts(1);
  }

  reload(): void {
    this.loadReceipts(this.receiptService.page());
  }

  changePage(direction: number): void {
    this.loadReceipts(this.receiptService.page() + direction);
  }

  openReceipt(receiptId: string): void {
    void this.router.navigate(['/dashboard/receipts', receiptId]);
  }

  hasActiveSearch(): boolean {
    return this.receiptNumber().trim().length > 0;
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

  private loadReceipts(page = 1): void {
    this.receiptService.loadReceipts({
      page,
      limit: this.pageSize,
      receiptNumber: this.receiptNumber().trim() || undefined,
    });
  }
}
