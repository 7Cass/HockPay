import { ForbiddenException } from '@nestjs/common';
import {
  CreateMerchantUseCase,
  GetCurrentMerchantUseCase,
  GetMerchantUseCase,
} from '@hockpay/core';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { MerchantController } from './merchant.controller';

describe('MerchantController', () => {
  let controller: MerchantController;
  let createMerchantUseCase: { execute: jest.Mock };
  let getMerchantUseCase: { execute: jest.Mock };
  let getCurrentMerchantUseCase: { execute: jest.Mock };

  beforeEach(() => {
    createMerchantUseCase = { execute: jest.fn() };
    getMerchantUseCase = { execute: jest.fn() };
    getCurrentMerchantUseCase = { execute: jest.fn() };

    controller = new MerchantController(
      createMerchantUseCase as unknown as CreateMerchantUseCase,
      getMerchantUseCase as unknown as GetMerchantUseCase,
      getCurrentMerchantUseCase as unknown as GetCurrentMerchantUseCase,
    );
  });

  it('does not mark GET /merchants/:id as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, MerchantController.prototype.findOne),
    ).toBeUndefined();
  });

  it('returns the authenticated merchant profile when ids match', async () => {
    const merchantId = '11111111-1111-4111-8111-111111111111';
    getMerchantUseCase.execute.mockResolvedValue({
      id: merchantId,
      name: 'Merchant',
    });

    const result = await controller.findOne(merchantId, {
      merchantId,
      storeId: null,
    });

    expect(getMerchantUseCase.execute).toHaveBeenCalledWith(merchantId);
    expect(result).toEqual({
      id: merchantId,
      name: 'Merchant',
    });
  });

  it('rejects access to a different merchant id', async () => {
    await expect(
      controller.findOne('22222222-2222-4222-8222-222222222222', {
        merchantId: '11111111-1111-4111-8111-111111111111',
        storeId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(getMerchantUseCase.execute).not.toHaveBeenCalled();
  });
});
