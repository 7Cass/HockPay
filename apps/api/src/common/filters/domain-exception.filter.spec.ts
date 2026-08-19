import { PaymentExpiredError } from '@hockpay/core';
import { DomainExceptionFilter } from './domain-exception.filter';

describe('DomainExceptionFilter', () => {
  it('maps public simulate PaymentExpiredError to 422 with the domain code', () => {
    const filter = new DomainExceptionFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          url: '/api/v1/payments/pay-1/simulate/confirm',
          method: 'POST',
          headers: {},
          id: 'req-1',
        }),
      }),
    };

    filter.catch(new PaymentExpiredError('pay-1'), host as never);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PAYMENT_EXPIRED',
          statusCode: 422,
          requestId: 'req-1',
        }),
      }),
    );
  });
});
