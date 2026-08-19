import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtOnlyGuard } from '../auth/guards/jwt-only.guard';
import { BankAccountController } from './bank-account.controller';

describe('BankAccountController', () => {
  it('keeps bank account mutations JWT-only', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        BankAccountController.prototype.create,
      ),
    ).toContain(JwtOnlyGuard);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        BankAccountController.prototype.setDefault,
      ),
    ).toContain(JwtOnlyGuard);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        BankAccountController.prototype.delete,
      ),
    ).toContain(JwtOnlyGuard);
  });
});
