import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateMerchantDto {
  @IsString()
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
  @MaxLength(100, { message: 'Nome nao pode exceder 100 caracteres' })
  name!: string;

  @IsEmail({}, { message: 'Email invalido' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Senha deve ter pelo menos 8 caracteres' })
  password!: string;

  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'Documento deve ser CPF (11 digitos) ou CNPJ (14 digitos)',
  })
  document!: string;

  @IsOptional()
  @IsUUID(4, { message: 'currentStoreId deve ser um UUID valido' })
  currentStoreId?: string;
}
