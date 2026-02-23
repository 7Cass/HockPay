import { MerchantNotFoundError } from '../../domain/errors/merchant-not-found.error';
import { IMerchantRepository } from '../../domain/repositories/merchant.repository.interface';
import { Merchant } from '../../domain/entities/merchant.entity';

/**
 * Output DTO for GetMerchantUseCase.
 */
export interface IGetMerchantOutput {
  id: string;
  name: string;
  email: string;
  document: string;
  formattedDocument: string;
  documentType: 'CPF' | 'CNPJ';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Use Case: Get Merchant
 *
 * This use case retrieves a merchant by ID.
 */
export class GetMerchantUseCase {
  constructor(private readonly merchantRepository: IMerchantRepository) {}

  async execute(id: string): Promise<IGetMerchantOutput> {
    const merchant = await this.merchantRepository.findById(id);

    if (!merchant) {
      throw new MerchantNotFoundError(id);
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
      updatedAt: merchant.updatedAt,
    };
  }
}
