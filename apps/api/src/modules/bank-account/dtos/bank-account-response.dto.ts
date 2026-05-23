import { BankAccount, BankAccountWithUsage } from '@hockpay/core';

export class BankAccountResponseDto {
  id: string;
  storeId: string;
  pixKey: string;
  pixKeyType: string;
  holderName: string;
  holderDocument: string;
  isDefault: boolean;
  isVerified: boolean;
  hasWithdrawals: boolean;
  hasActiveWithdrawals: boolean;
  withdrawalCount: number;
  activeWithdrawalCount: number;
  createdAt: Date;
  updatedAt: Date;

  static fromDomain(entity: BankAccount): BankAccountResponseDto {
    const dto = new BankAccountResponseDto();
    dto.id = entity.id;
    dto.storeId = entity.storeId;
    dto.pixKey = entity.pixKey;
    dto.pixKeyType = entity.pixKeyType;
    dto.holderName = entity.holderName;
    dto.holderDocument = entity.holderDocument;
    dto.isDefault = entity.isDefault;
    dto.isVerified = entity.isVerified;
    dto.hasWithdrawals = false;
    dto.hasActiveWithdrawals = false;
    dto.withdrawalCount = 0;
    dto.activeWithdrawalCount = 0;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  static fromDomainList(entities: BankAccount[]): BankAccountResponseDto[] {
    return entities.map((entity) => BankAccountResponseDto.fromDomain(entity));
  }

  static fromUsage(item: BankAccountWithUsage): BankAccountResponseDto {
    const dto = BankAccountResponseDto.fromDomain(item.bankAccount);
    dto.hasWithdrawals = item.hasWithdrawals;
    dto.hasActiveWithdrawals = item.hasActiveWithdrawals;
    dto.withdrawalCount = item.withdrawalCount;
    dto.activeWithdrawalCount = item.activeWithdrawalCount;
    return dto;
  }

  static fromUsageList(
    items: BankAccountWithUsage[],
  ): BankAccountResponseDto[] {
    return items.map((item) => BankAccountResponseDto.fromUsage(item));
  }

  static fromObject(entity: {
    id: string;
    storeId: string;
    pixKey: string;
    pixKeyType: string;
    holderName: string;
    holderDocument: string;
    isDefault: boolean;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): BankAccountResponseDto {
    const dto = new BankAccountResponseDto();
    dto.id = entity.id;
    dto.storeId = entity.storeId;
    dto.pixKey = entity.pixKey;
    dto.pixKeyType = entity.pixKeyType;
    dto.holderName = entity.holderName;
    dto.holderDocument = entity.holderDocument;
    dto.isDefault = entity.isDefault;
    dto.isVerified = entity.isVerified;
    dto.hasWithdrawals = false;
    dto.hasActiveWithdrawals = false;
    dto.withdrawalCount = 0;
    dto.activeWithdrawalCount = 0;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
