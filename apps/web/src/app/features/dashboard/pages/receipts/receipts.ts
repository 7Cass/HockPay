import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideReceipt, lucideRefreshCcw, lucideSearch } from '@ng-icons/lucide';
import { ReceiptService } from '../../../../core/services/receipt.service';
import { PageHeader, PageState, Pagination, StatusChip } from '../../../../shared/ui';

@Component({
  selector: 'app-receipts',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    NgIcon,
    RouterLink,
    PageHeader,
    PageState,
    Pagination,
    StatusChip,
  ],
  providers: [
    provideIcons({ lucideArrowRight, lucideReceipt, lucideRefreshCcw, lucideSearch }),
  ],
  templateUrl: './receipts.html',
  styleUrl: './receipts.css',
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

  goToPage(page: number): void {
    this.loadReceipts(page);
  }

  openReceipt(receiptId: string): void {
    void this.router.navigate(['/dashboard/receipts', receiptId]);
  }

  hasActiveSearch(): boolean {
    return this.receiptNumber().trim().length > 0;
  }

  private loadReceipts(page = 1): void {
    this.receiptService.loadReceipts({
      page,
      limit: this.pageSize,
      receiptNumber: this.receiptNumber().trim() || undefined,
    });
  }
}
