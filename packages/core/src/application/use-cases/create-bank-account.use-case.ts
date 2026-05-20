import {
  BankAccount,
  PixKeyType,
} from "../../domain/entities/bank-account.entity";
import { IUnitOfWork } from "../../domain/repositories/unit-of-work.interface";

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

  async execute(
    dto: CreateBankAccountDto,
    merchantDocument: string,
  ): Promise<BankAccount> {
    // Business Rule 1: Titularidade Obrigatoria
    // The holder document MUST match the merchant document
    const cleanHolderDoc = dto.holderDocument.replace(/\D/g, "");
    const cleanMerchantDoc = merchantDocument.replace(/\D/g, "");

    if (cleanHolderDoc !== cleanMerchantDoc) {
      throw new Error(
        `Holder document (${dto.holderDocument}) does not match merchant document (${merchantDocument}). Third-party accounts are not allowed.`,
      );
    }

    // Business Rule 2: Validation of PIX Key Types vs holderDocument
    let isVerified = false;
    if (
      dto.pixKeyType === PixKeyType.CPF ||
      dto.pixKeyType === PixKeyType.CNPJ
    ) {
      const cleanPixKey = dto.pixKey.replace(/\D/g, "");
      if (cleanPixKey === cleanHolderDoc) {
        // High confidence: The CPF/CNPJ Pix key matches the account holder document
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

    // Use Unit of Work to handle potential "isDefault" race conditions safely
    await this.unitOfWork.execute(async (repos) => {
      await repos.bankAccountRepository.save(bankAccount);

      // If this new account is marked as default, clear the default flag on others
      if (bankAccount.isDefault) {
        await repos.bankAccountRepository.clearDefaultFlagExcept(
          bankAccount.storeId,
          bankAccount.id,
        );
      }
    });

    return bankAccount;
  }
}
