import { Injectable, inject } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { Observable } from 'rxjs';

/**
 * Matching the shared Environment enum from @hockpay/core
 */
export enum Environment {
    TEST = 'TEST',
    LIVE = 'LIVE'
}

export interface ApiKey {
    id: string;
    storeId: string;
    name: string;
    prefix: string;
    environment: Environment | string;
    createdAt: Date | string;
}

export interface ListApiKeysResponse {
    apiKeys: ApiKey[];
}

export interface CreateApiKeyRequest {
    name: string;
    environment: Environment | string;
}

export interface CreateApiKeyResponse extends ApiKey {
    plainKey: string;
}

@Injectable({
    providedIn: 'root'
})
export class ApiKeyService {
    private readonly apiClient = inject(ApiClientService);
    private readonly endpoint = '/api-keys';

    /**
     * List all API keys for the current authenticated store.
     * Returns keys without their plain secrets.
     */
    list(): Observable<ListApiKeysResponse> {
        return this.apiClient.get<ListApiKeysResponse>(this.endpoint);
    }

    /**
     * Create a new API Key (e.g., TEST or LIVE).
     * Note: The plainKey is returning only once in this response!
     */
    create(data: CreateApiKeyRequest): Observable<CreateApiKeyResponse> {
        return this.apiClient.post<CreateApiKeyResponse>(this.endpoint, data);
    }

    /**
     * Revoke an API Key, preventing it from being used for authentication.
     */
    revoke(id: string): Observable<{ message: string; apiKey: ApiKey }> {
        return this.apiClient.post<{ message: string; apiKey: ApiKey }>(`${this.endpoint}/${id}/revoke`, {});
    }
}
