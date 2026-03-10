import { MerchantNotFoundError } from '../../domain/errors/merchant-not-found.error';
import { IMerchantRepository } from '../../domain/repositories/merchant.repository.interface';

/**
 * Output DTO for GetCurrentMerchantUseCase.
 * Contains only non-sensitive merchant data.
 */
export interface IGetCurrentMerchantOutput {
    id: string;
    name: string;
    email: string;
    document: string;
    formattedDocument: string;
    documentType: 'CPF' | 'CNPJ';
    isActive: boolean;
    createdAt: Date;
    currentStoreId?: string;
}

/**
 * Use Case: Get Current Merchant
 *
 * Retrieves the currently authenticated merchant's profile.
 * Unlike GetMerchantUseCase, this receives the merchantId from the JWT
 * rather than from a URL parameter.
 */
export class GetCurrentMerchantUseCase {
    constructor(private readonly merchantRepository: IMerchantRepository) { }

    async execute(merchantId: string): Promise<IGetCurrentMerchantOutput> {
        const merchant = await this.merchantRepository.findById(merchantId);

        if (!merchant) {
            throw new MerchantNotFoundError(merchantId);
        }

        return {
            id: merchant.id,
            name: merchant.name,
            email: merchant.email.toString(),
            document: merchant.document.value,
            formattedDocument: merchant.document.formatted,
            documentType: merchant.document.type,
            isActive: merchant.isActive,
            createdAt: merchant.createdAt,
            currentStoreId: merchant.currentStoreId,
        };
    }
}
