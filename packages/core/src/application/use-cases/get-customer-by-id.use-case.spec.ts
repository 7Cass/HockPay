import { describe, expect, it, vi } from 'vitest';
import { Customer } from '../../domain/entities/customer.entity';
import { CustomerNotFoundError } from '../../domain/errors/customer-not-found.error';
import { Document } from '../../domain/value-objects/document.vo';
import { GetCustomerByIdUseCase } from './get-customer-by-id.use-case';

describe('GetCustomerByIdUseCase', () => {
  it('returns a customer when it belongs to the store', async () => {
    const customer = Customer.create({
      storeId: 'store-1',
      externalId: 'cust_123',
      document: new Document('52998224725'),
      name: 'Cliente Teste',
    });

    const repository = {
      findById: vi.fn().mockResolvedValue(customer),
    };

    const useCase = new GetCustomerByIdUseCase(repository as any);

    const result = await useCase.execute({
      storeId: 'store-1',
      customerId: customer.id,
    });

    expect(repository.findById).toHaveBeenCalledWith(customer.id);
    expect(result.customer.id).toBe(customer.id);
    expect(result.customer.externalId).toBe('cust_123');
  });

  it('fails when the customer does not exist', async () => {
    const useCase = new GetCustomerByIdUseCase({
      findById: vi.fn().mockResolvedValue(null),
    } as any);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        customerId: 'missing-customer',
      }),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it('fails when the customer belongs to another store', async () => {
    const customer = Customer.create({
      storeId: 'other-store',
      document: new Document('52998224725'),
    });

    const useCase = new GetCustomerByIdUseCase({
      findById: vi.fn().mockResolvedValue(customer),
    } as any);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        customerId: customer.id,
      }),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });
});
