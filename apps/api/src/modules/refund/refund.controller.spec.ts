import 'reflect-metadata';
import { IDEMPOTENCY_KEY } from '../../common/decorators/idempotent.decorator';
import { RefundController } from './refund.controller';

describe('RefundController', () => {
  it('requires an Idempotency-Key for refund creation', () => {
    const metadata = Reflect.getMetadata(
      IDEMPOTENCY_KEY,
      RefundController.prototype.createRefund,
    );

    expect(metadata).toEqual({ required: true });
  });
});
