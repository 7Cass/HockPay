import { Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';

/**
 * Rodapé de lista paginada.
 *
 *   <app-pagination
 *     [page]="svc.page()" [totalPages]="svc.totalPages()"
 *     [total]="svc.total()" [shown]="svc.customers().length"
 *     noun="clientes" (pageChange)="goToPage($event)" />
 *
 * Emite a página de destino, não um delta: quem chama não precisa saber onde
 * estava. Os botões já respeitam os limites, então `pageChange` nunca sai fora
 * do intervalo.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [DecimalPipe, NgIcon],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight })],
  templateUrl: './pagination.html',
  styleUrl: './pagination.css',
})
export class Pagination {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();

  /** Total de registros no filtro atual. */
  readonly total = input.required<number>();

  /** Quantos vieram nesta página. */
  readonly shown = input.required<number>();

  /** Plural do que está sendo listado: "clientes", "pagamentos". */
  readonly noun = input('registros');

  readonly pageChange = output<number>();

  protected readonly lastPage = computed(() => Math.max(1, this.totalPages()));
  protected readonly hasPrevious = computed(() => this.page() > 1);
  protected readonly hasNext = computed(() => this.page() < this.lastPage());

  protected previous(): void {
    if (this.hasPrevious()) this.pageChange.emit(this.page() - 1);
  }

  protected next(): void {
    if (this.hasNext()) this.pageChange.emit(this.page() + 1);
  }
}
