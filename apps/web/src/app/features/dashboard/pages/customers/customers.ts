import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideRefreshCcw, lucideSearch, lucideUsers } from '@ng-icons/lucide';
import { CustomerObject, CustomerService } from '../../../../core/services/customer.service';
import { PageHeader, PageState, Pagination } from '../../../../shared/ui';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [DatePipe, NgIcon, RouterLink, PageHeader, PageState, Pagination],
  providers: [provideIcons({ lucideArrowRight, lucideRefreshCcw, lucideSearch, lucideUsers })],
  templateUrl: './customers.html',
  styleUrl: './customers.css',
})
export class Customers implements OnInit {
  readonly customerService = inject(CustomerService);
  private readonly router = inject(Router);

  readonly search = signal('');
  private readonly pageSize = 20;

  ngOnInit(): void {
    this.loadCustomers();
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }

  applySearch(): void {
    this.loadCustomers(1);
  }

  clearSearch(): void {
    this.search.set('');
    this.loadCustomers(1);
  }

  reload(): void {
    this.loadCustomers(this.customerService.page());
  }

  goToPage(page: number): void {
    this.loadCustomers(page);
  }

  openCustomer(customerId: string): void {
    void this.router.navigate(['/dashboard/customers', customerId]);
  }

  hasActiveSearch(): boolean {
    return this.search().trim().length > 0;
  }

  displayName(customer: CustomerObject): string {
    return customer.name || customer.email || customer.externalId || customer.formattedDocument;
  }

  private loadCustomers(page = 1): void {
    this.customerService.loadCustomers({
      page,
      limit: this.pageSize,
      search: this.search().trim() || undefined,
    });
  }
}
