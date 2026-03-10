import { IsString, IsEnum, IsBoolean, IsOptional, MaxLength } from 'class-validator';
import { PixKeyType } from '@hockpay/core';

export class CreateBankAccountDto {
    @IsString()
    @MaxLength(255)
    pixKey: string;

    @IsEnum(PixKeyType)
    pixKeyType: PixKeyType;

    @IsString()
    @MaxLength(255)
    holderName: string;

    @IsString()
    @MaxLength(255)
    holderDocument: string;

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}
