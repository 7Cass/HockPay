import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight } from '@ng-icons/lucide';
import { ReceiptService } from '../../../../core/services/receipt.service';
import { CopyValue, PageHeader, PageState, StatusChip } from '../../../../shared/ui';

@Component({
  selector: 'app-receipt-detail',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    NgIcon,
    RouterLink,
    CopyValue,
    PageHeader,
    PageState,
    StatusChip,
  ],
  providers: [provideIcons({ lucideArrowRight })],
  templateUrl: './receipt-detail.html',
  styleUrl: './receipt-detail.css',
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
}
