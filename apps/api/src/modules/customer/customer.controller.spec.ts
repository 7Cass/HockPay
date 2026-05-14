import { NotFoundException } from '@nestjs/common';
import {
  CreateCustomerUseCase,
  CustomerNotFoundError,
  GetCustomerByIdUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
} from '@hockpay/core';
import { CustomerController } from './customer.controller';

describe('CustomerController', () => {
  let controller: CustomerController;
  let createCustomerUseCase: { execute: jest.Mock };
  let listCustomersUseCase: { execute: jest.Mock };
  let getCustomerUseCase: { execute: jest.Mock };
  let getCustomerByIdUseCase: { execute: jest.Mock };
  let updateCustomerUseCase: { execute: jest.Mock };

  beforeEach(() => {
    createCustomerUseCase = { execute: jest.fn() };
    listCustomersUseCase = { execute: jest.fn() };
    getCustomerUseCase = { execute: jest.fn() };
    getCustomerByIdUseCase = { execute: jest.fn() };
    updateCustomerUseCase = { execute: jest.fn() };

    controller = new CustomerController(
      createCustomerUseCase as unknown as CreateCustomerUseCase,
      listCustomersUseCase as unknown as ListCustomersUseCase,
      getCustomerUseCase as unknown as GetCustomerUseCase,
      getCustomerByIdUseCase as unknown as GetCustomerByIdUseCase,
      updateCustomerUseCase as unknown as UpdateCustomerUseCase,
    );
  });

  it('forwards list filters to the list use case', async () => {
    listCustomersUseCase.execute.mockResolvedValue({
      customers: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    await controller.listCustomers(
      {
        page: 1,
        limit: 20,
        search: 'cliente',
      },
      { store: { id: 'store-1' } } as any,
    );

    expect(listCustomersUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      page: 1,
      limit: 20,
      search: 'cliente',
    });
  });

  it('loads a customer by internal id for dashboard navigation', async () => {
    getCustomerByIdUseCase.execute.mockResolvedValue({
      customer: {
        id: 'customer-1',
        storeId: 'store-1',
        document: '52998224725',
        formattedDocument: '529.982.247-25',
        documentType: 'CPF',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await controller.getCustomerById('customer-1', {
      store: { id: 'store-1' },
    } as any);

    expect(getCustomerByIdUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      customerId: 'customer-1',
    });
    expect(result.customer.id).toBe('customer-1');
  });

  it('maps customer-not-found errors to NotFoundException on id lookup', async () => {
    getCustomerByIdUseCase.execute.mockRejectedValue(
      new CustomerNotFoundError('customer-404'),
    );

    await expect(
      controller.getCustomerById('customer-404', {
        store: { id: 'store-1' },
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
