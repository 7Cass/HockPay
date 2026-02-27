import { inject, Injectable } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { Observable } from 'rxjs';

export interface CreateMerchantDto {
    name: string;
    email: string;
    password?: string;
    document: string;
}

export interface CreateMerchantResponse {
    id: string;
    name: string;
    email: string;
    document: string;
    createdAt: string;
}

export interface MerchantProfile {
    id: string;
    name: string;
    email: string;
    document: string;
    formattedDocument: string;
    documentType: 'CPF' | 'CNPJ';
    isActive: boolean;
    createdAt: string;
}

@Injectable({
    providedIn: 'root'
})
export class MerchantService {
    private readonly api = inject(ApiClientService);

    /**
     * Registers a new merchant in the API.
     * @param dto Registration payload (Name, Email, Document, Password)
     */
    create(dto: CreateMerchantDto): Observable<CreateMerchantResponse> {
        const unmaskedDocument = dto.document.replace(/\D/g, ''); // Ensure only numbers are sent

        return this.api.post<CreateMerchantResponse>('/merchants', {
            ...dto,
            document: unmaskedDocument
        });
    }

    /**
     * Retrieves the authenticated merchant's profile.
     */
    getMe(): Observable<MerchantProfile> {
        return this.api.get<MerchantProfile>('/merchants/me');
    }
}
