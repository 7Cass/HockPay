import { Customer, CustomerObject } from '../../domain/entities/customer.entity';
import { Document } from '../../domain/value-objects/document.vo';
import { ICustomerRepository } from '../../domain/repositories/customer.repository.interface';
import { CustomerAlreadyExistsError } from '../../domain/errors/customer-already-exists.error';
import { DocumentAlreadyInUseError } from '../../domain/errors/document-already-in-use.error';

/**
 * Input DTO for CreateCustomerUseCase.
 */
export interface ICreateCustomerInput {
  storeId: string;
  externalId?: string;
  name?: string;
  email?: string;
  document: string;
  phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  metadata?: Record<string, unknown>;
  updateExisting?: boolean;
}

/**
 * Output DTO for CreateCustomerUseCase.
 */
export interface ICreateCustomerOutput {
  customer: CustomerObject;
  created: boolean;
}

/**
 * Use Case: Create Customer
 *
 * This use case handles creating a new customer or updating an existing one.
 *
 * Business rules:
 * - externalId is unique per store
 * - document is unique per store
 * - If externalId exists and updateExisting=false: throw CustomerAlreadyExistsError
 * - If externalId exists and updateExisting=true: update the customer
 * - If document exists in another customer: throw DocumentAlreadyInUseError
 */
export class CreateCustomerUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(input: ICreateCustomerInput): Promise<ICreateCustomerOutput> {
    // 1. Validate and create Document value object
    const document = new Document(input.document);

    // 2. Check if externalId already exists (if provided)
    if (input.externalId) {
      const existingByExternalId = await this.customerRepository.findByExternalId(
        input.storeId,
        input.externalId,
      );

      if (existingByExternalId) {
        // If updateExisting is true, update the customer
        if (input.updateExisting) {
          // Check if document is being changed to one that's already in use
          if (input.document && !existingByExternalId.document.equals(document)) {
            const existingByDocument = await this.customerRepository.findByDocument(
              input.storeId,
              input.document,
            );

            if (existingByDocument && existingByDocument.id !== existingByExternalId.id) {
              throw new DocumentAlreadyInUseError(
                existingByDocument.externalId ?? existingByDocument.id,
              );
            }
          }

          // Update the existing customer
          existingByExternalId.update({
            name: input.name,
            email: input.email,
            phone: input.phone,
            street: input.street,
            number: input.number,
            complement: input.complement,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            country: input.country,
          });

          await this.customerRepository.update(existingByExternalId);

          return {
            customer: existingByExternalId.toObject(),
            created: false,
          };
        }

        // If updateExisting is false, throw error
        throw new CustomerAlreadyExistsError(existingByExternalId.id);
      }
    }

    // 3. Check if document already exists in another customer
    const existingByDocument = await this.customerRepository.findByDocument(
      input.storeId,
      input.document,
    );

    if (existingByDocument) {
      throw new DocumentAlreadyInUseError(existingByDocument.externalId ?? existingByDocument.id);
    }

    // 4. Create new customer
    const customer = Customer.create({
      storeId: input.storeId,
      externalId: input.externalId,
      name: input.name,
      email: input.email,
      document,
      phone: input.phone,
      street: input.street,
      number: input.number,
      complement: input.complement,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      country: input.country,
      metadata: input.metadata,
    });

    // 5. Persist customer
    await this.customerRepository.save(customer);

    // 6. Return output
    return {
      customer: customer.toObject(),
      created: true,
    };
  }
}
