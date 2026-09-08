import {
  CompleteWithdrawalUseCase,
  Environment,
  FailWithdrawalUseCase,
} from '@hockpay/core';
import { WithdrawalDevController } from './withdrawal-dev.controller';

describe('WithdrawalDevController', () => {
  function makeController() {
    const completeWithdrawalUseCase = {
      execute: jest.fn().mockResolvedValue({ withdrawal: { id: 'w-1' } }),
    };
    const failWithdrawalUseCase = {
      execute: jest.fn().mockResolvedValue({ withdrawal: { id: 'w-1' } }),
    };

    return {
      controller: new WithdrawalDevController(
        completeWithdrawalUseCase as unknown as CompleteWithdrawalUseCase,
        failWithdrawalUseCase as unknown as FailWithdrawalUseCase,
      ),
      completeWithdrawalUseCase,
      failWithdrawalUseCase,
    };
  }

  it.each([Environment.TEST, Environment.LIVE])(
    'forwards the caller environment %s instead of refusing it at the door',
    async (environment) => {
      const { controller, completeWithdrawalUseCase } = makeController();

      await controller.complete('w-1', 'store-1', environment);

      // The controller no longer decides whether LIVE is allowed. The use case
      // answers, with STORE_LIVE_NOT_ENABLED when the desk has not opened it --
      // the same rule that gates charging in LIVE.
      expect(completeWithdrawalUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          withdrawalId: 'w-1',
          storeId: 'store-1',
          simulation: true,
          callerEnvironment: environment,
        }),
      );
    },
  );

  it('forwards the caller environment when failing a withdrawal', async () => {
    const { controller, failWithdrawalUseCase } = makeController();

    await controller.fail('w-1', {}, 'store-1', Environment.LIVE);

    expect(failWithdrawalUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        simulation: true,
        callerEnvironment: Environment.LIVE,
      }),
    );
  });
});
