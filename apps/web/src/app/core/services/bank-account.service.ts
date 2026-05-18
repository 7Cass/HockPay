import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

export interface BankAccount {
    id: string;
    storeId: string;
    pixKey: string;
    pixKeyType: PixKeyType;
    holderName: string;
    holderDocument: string;
    isDefault: boolean;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateBankAccountInput {
    pixKey: string;
    pixKeyType: PixKeyType;
    holderName: string;
    holderDocument: string;
    isDefault?: boolean;
}

@Injectable({
    providedIn: 'root',
})
export class BankAccountService {
    private readonly apiClient = inject(ApiClientService);

    list(): Observable<BankAccount[]> {
        return this.apiClient.get<BankAccount[]>('/bank-accounts');
    }

    create(input: CreateBankAccountInput): Observable<BankAccount> {
        return this.apiClient.post<BankAccount>('/bank-accounts', input);
    }

    delete(id: string): Observable<void> {
        return this.apiClient.delete<void>(`/bank-accounts/${id}`);
    }
}
