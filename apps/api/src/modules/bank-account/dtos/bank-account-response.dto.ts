import { BankAccount } from '@hockpay/core';

export class BankAccountResponseDto {
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
        dto.createdAt = entity.createdAt;
        dto.updatedAt = entity.updatedAt;
        return dto;
    }

    static fromDomainList(entities: BankAccount[]): BankAccountResponseDto[] {
        return entities.map(entity => BankAccountResponseDto.fromDomain(entity));
    }
}
