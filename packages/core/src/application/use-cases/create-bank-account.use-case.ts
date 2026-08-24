import { BankAccount, PixKeyType } from '../../domain/entities/bank-account.entity';
import { BankAccountHolderMismatchError } from '../../domain/errors/bank-account-holder-mismatch.error';
import { MerchantNotFoundError } from '../../domain/errors/merchant-not-found.error';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export interface CreateBankAccountDto {
  storeId: string;
  pixKey: string;
  pixKeyType: PixKeyType;
  holderName: string;
  holderDocument: string;
  isDefault?: boolean;
}

export class CreateBankAccountUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(dto: CreateBankAccountDto): Promise<BankAccount> {
    return this.unitOfWork.execute(async (repos) => {
      const store = await repos.storeRepository.findById(dto.storeId);
      if (!store) {
        throw new StoreNotFoundError(dto.storeId);
      }

      const merchant = await repos.merchantRepository.findById(store.merchantId);
      if (!merchant) {
        throw new MerchantNotFoundError(store.merchantId);
      }

      const merchantDocument = merchant.document.value;
      const cleanHolderDoc = dto.holderDocument.replace(/\D/g, '');
      const cleanMerchantDoc = merchantDocument.replace(/\D/g, '');

      if (cleanHolderDoc !== cleanMerchantDoc) {
        throw new BankAccountHolderMismatchError(dto.holderDocument, merchantDocument);
      }

      let isVerified = false;
      if (dto.pixKeyType === PixKeyType.CPF || dto.pixKeyType === PixKeyType.CNPJ) {
        const cleanPixKey = dto.pixKey.replace(/\D/g, '');
        if (cleanPixKey === cleanHolderDoc) {
          isVerified = true;
        }
      }

      const bankAccount = BankAccount.create({
        storeId: dto.storeId,
        pixKey: dto.pixKey,
        pixKeyType: dto.pixKeyType,
        holderName: dto.holderName,
        holderDocument: dto.holderDocument,
        isDefault: dto.isDefault,
      });

      if (isVerified) {
        bankAccount.verify();
      }

      await repos.bankAccountRepository.save(bankAccount);

      if (bankAccount.isDefault) {
        await repos.bankAccountRepository.clearDefaultFlagExcept(
          bankAccount.storeId,
          bankAccount.id,
        );
      }

      return bankAccount;
    });
  }
}
