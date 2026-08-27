import { CurrencyPipe, DatePipe, JsonPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideCreditCard,
  lucideReceipt,
  lucideRefreshCcw,
} from '@ng-icons/lucide';
import { CustomerObject, CustomerService } from '../../../../core/services/customer.service';
import {
  PaymentObject,
  PaymentService,
  PaymentStatus,
} from '../../../../core/services/payment.service';
import { ReceiptService } from '../../../../core/services/receipt.service';
import { CopyValue, PageHeader, PageState, StatusChip } from '../../../../shared/ui';

/** Dinheiro que entrou: confirmado, liquidado, ou estornado depois de entrar. */
const PAID_STATUSES = [PaymentStatus.CONFIRMED, PaymentStatus.RELEASED, PaymentStatus.REFUNDED];

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    JsonPipe,
    NgIcon,
    RouterLink,
    CopyValue,
    PageHeader,
    PageState,
    StatusChip,
  ],
  providers: [
    provideIcons({ lucideArrowRight, lucideCreditCard, lucideReceipt, lucideRefreshCcw }),
  ],
  templateUrl: './customer-detail.html',
  styleUrl: './customer-detail.css',
})
export class CustomerDetail implements OnInit, OnDestroy {
  readonly customerService = inject(CustomerService);
  readonly paymentService = inject(PaymentService);
  readonly receiptService = inject(ReceiptService);

  readonly totalPaidAmount = computed(() =>
    this.paymentService
      .payments()
      .filter((payment) => PAID_STATUSES.includes(payment.status))
      .reduce((sum, payment) => sum + payment.amount, 0),
  );
  readonly totalReceiptsAmount = computed(() =>
    this.receiptService.receipts().reduce((sum, receipt) => sum + receipt.amount, 0),
  );
  readonly lastPayment = computed<PaymentObject | null>(
    () => this.paymentService.payments()[0] ?? null,
  );

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private customerId = '';

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.customerId) {
      this.goBack();
      return;
    }

    this.reload();
  }

  ngOnDestroy(): void {
    this.customerService.clearDetailState();
  }

  reload(): void {
    this.customerService.loadCustomer(this.customerId);
    this.paymentService.loadPayments({ customerId: this.customerId, page: 1, limit: 10 });
    this.receiptService.loadReceipts({ customerId: this.customerId, page: 1, limit: 10 });
  }

  goBack(): void {
    void this.router.navigate(['/dashboard/customers']);
  }

  openPayment(paymentId: string): void {
    void this.router.navigate(['/dashboard/payments', paymentId]);
  }

  openReceipt(receiptId: string): void {
    void this.router.navigate(['/dashboard/receipts', receiptId]);
  }

  displayName(customer: CustomerObject): string {
    return customer.name || customer.email || customer.externalId || customer.formattedDocument;
  }

  addressLine(customer: CustomerObject): string {
    const parts = [customer.street, customer.number, customer.complement].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Não informado';
  }

  locationLine(customer: CustomerObject): string {
    return [customer.city, customer.state, customer.zipCode].filter(Boolean).join(' · ');
  }

  metadataEntries(customer: CustomerObject): [string, unknown][] {
    return Object.entries(customer.metadata || {});
  }

  /** O resumo soma o que veio, não o que existe — e diz qual dos dois é. */
  summaryScopeLabel(loaded: number, total: number): string {
    if (loaded === 0) return 'Sem registros carregados';
    return loaded < total ? `Soma dos ${loaded} carregados` : 'Soma de todos os registros';
  }
}
