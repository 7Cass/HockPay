import { Merchant } from '../../domain/entities/merchant.entity';
import { Email } from '../../domain/value-objects/email.vo';
import { Document } from '../../domain/value-objects/document.vo';
import { MerchantAlreadyExistsError } from '../../domain/errors/merchant-already-exists.error';
import { IMerchantRepository } from '../../domain/repositories/merchant.repository.interface';
import { IPasswordHasherPort } from '../ports/password-hasher.port';

/**
 * Input DTO for CreateMerchantUseCase.
 */
export interface ICreateMerchantInput {
  name: string;
  email: string;
  password: string;
  document: string;
  currentStoreId?: string; // ← Novo campo!
}

/**
 * Output DTO for CreateMerchantUseCase.
 */
export interface ICreateMerchantOutput {
  id: string;
  name: string;
  email: string;
  document: string;
  formattedDocument: string;
  documentType: 'CPF' | 'CNPJ';
  isActive: boolean;
  createdAt: Date;
}

/**
 * Use Case: Create Merchant
 *
 * This use case handles the creation of a new merchant account.
 * It encapsulates the business logic for merchant creation.
 */
export class CreateMerchantUseCase {
  constructor(
    private readonly merchantRepository: IMerchantRepository,
    private readonly passwordHasher: IPasswordHasherPort,
  ) {}

  async execute(input: ICreateMerchantInput): Promise<ICreateMerchantOutput> {
    // 1. Create value objects (validation happens here)
    const email = new Email(input.email);
    const document = new Document(input.document);

    // 2. Check if merchant already exists
    const exists = await this.merchantRepository.existsByEmailOrDocument(
      email.toString(),
      document.value,
    );

    if (exists) {
      throw new MerchantAlreadyExistsError();
    }

    // 3. Hash the password
    const passwordHash = await this.passwordHasher.hash(input.password);

    // 4. Create the merchant entity
    const merchant = Merchant.create({
      name: input.name,
      email,
      document,
      passwordHash,
    });

    // 5. Persist the merchant
    await this.merchantRepository.save(merchant);

    // 6. Return the output
    return merchant.toObject();
  }
}
